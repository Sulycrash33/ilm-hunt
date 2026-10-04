-- Serialize multiplayer room membership and lifecycle transitions.
-- Preserve authenticated host bootstrap and own readiness updates.
create or replace function public.join_room_rpc(p_room_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  r public.quiz_rooms%rowtype;
  members integer;
begin
  if u is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where code = upper(btrim(p_room_code)) for update;
  if r.id is null then raise exception 'Room not found'; end if;
  -- A lost successful response can be retried even after the countdown starts.
  if exists(select 1 from public.quiz_room_players where room_id=r.id and user_id=u) then return r.id; end if;
  if r.status <> 'waiting' then raise exception 'Room is not accepting players'; end if;
  if not exists(select 1 from public.quiz_room_players where room_id=r.id and user_id=r.host_id) then
    raise exception 'Room host is still joining. Try again.';
  end if;
  select count(*) into members from public.quiz_room_players where room_id=r.id;
  if members >= r.max_players then raise exception 'Room is full'; end if;
  insert into public.quiz_room_players(room_id,user_id) values(r.id,u);
  update public.quiz_rooms set current_players=members+1 where id=r.id;
  return r.id;
end;
$$;

create or replace function public.leave_room_rpc(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  r public.quiz_rooms%rowtype;
  removed uuid;
  members integer;
  next_host uuid;
  next_name text;
begin
  if u is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where id=p_room_id for update;
  if r.id is null then return; end if;
  delete from public.quiz_room_players where room_id=p_room_id and user_id=u returning user_id into removed;
  if removed is null then return; end if;
  select count(*) into members from public.quiz_room_players where room_id=p_room_id;
  if members=0 then delete from public.quiz_rooms where id=p_room_id; return; end if;
  if r.host_id=u then
    select user_id into next_host from public.quiz_room_players where room_id=p_room_id order by joined_at,id limit 1;
    update public.quiz_room_players set is_host=(user_id=next_host) where room_id=p_room_id;
    select user_name into next_name from public.quiz_room_players where room_id=p_room_id and user_id=next_host;
    update public.quiz_rooms set host_id=next_host,host_name=next_name,current_players=members where id=p_room_id;
  else
    update public.quiz_rooms set current_players=members where id=p_room_id;
  end if;
end;
$$;

create or replace function public.restart_room_rpc(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  r public.quiz_rooms%rowtype;
begin
  if u is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where id=p_room_id for update;
  if r.id is null or r.host_id<>u then raise exception 'Only the host can restart the room.'; end if;
  if r.status='waiting' then return; end if;
  if r.status<>'finished' then raise exception 'Finish the current quiz before restarting.'; end if;
  update public.quiz_room_players set score=0,correct_answers=0,total_answers=0,streak=0,
    is_ready=(user_id=r.host_id) where room_id=p_room_id;
  delete from public.quiz_room_answers where room_id=p_room_id;
  delete from public.quiz_room_questions where room_id=p_room_id;
  update public.quiz_rooms set status='waiting',current_question=0,starts_at=null,finished_at=null,
    current_players=(select count(*) from public.quiz_room_players where room_id=p_room_id)
    where id=p_room_id;
end;
$$;

revoke all on function public.join_room_rpc(text) from public,anon;
revoke all on function public.leave_room_rpc(uuid) from public,anon;
revoke all on function public.restart_room_rpc(uuid) from public,anon;
grant execute on function public.join_room_rpc(text),public.leave_room_rpc(uuid),public.restart_room_rpc(uuid) to authenticated;

-- Direct inserts are retained solely for the existing client host bootstrap.
drop policy if exists "Authenticated users can join rooms" on public.quiz_room_players;
drop policy if exists "Authenticated users can join rooms as themselves" on public.quiz_room_players;
create policy "Authenticated users can join rooms as themselves" on public.quiz_room_players
  for insert to authenticated with check (
    user_id=(select auth.uid()) and is_host=true and exists(
      select 1 from public.quiz_rooms r where r.id=room_id and r.host_id=(select auth.uid()) and r.status='waiting'
    )
  );
drop policy if exists "Authenticated users can create rooms" on public.quiz_rooms;
create policy "Authenticated users can create rooms" on public.quiz_rooms
  for insert to authenticated with check (
    host_id=(select auth.uid()) and status='waiting' and current_players=1
    and current_question=0 and starts_at is null and finished_at is null
  );
revoke delete on public.quiz_room_players from public,anon,authenticated;
revoke update on public.quiz_rooms from public,anon,authenticated;
-- Table revocation does not remove independently granted column privileges.
do $$
declare col record;
begin
  for col in select column_name from information_schema.columns
    where table_schema='public' and table_name='quiz_rooms'
  loop
    execute format('revoke update (%I) on public.quiz_rooms from public,anon,authenticated',col.column_name);
  end loop;
end;
$$;

-- Existing question selection/timer behavior preserved; enforce readiness.
CREATE OR REPLACE FUNCTION public.start_multiplayer_quiz_rpc(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.quiz_rooms%rowtype;
  seeded integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Room not found.'; end if;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start the quiz.'; end if;
  if r.status <> 'waiting' then return; end if;
  if (select count(*) from public.quiz_room_players where room_id = p_room_id) < 2 then
    raise exception 'Invite another player before starting.';
  end if;
  if not exists(select 1 from public.quiz_room_players where room_id=p_room_id and user_id=r.host_id) then raise exception 'Host must be in the room.'; end if;
  if exists(select 1 from public.quiz_room_players where room_id=p_room_id and user_id<>r.host_id and not is_ready) then raise exception 'Wait until all players are ready.'; end if;
  if r.question_count not between 1 and 50 then raise exception 'Invalid question count.'; end if;
  insert into public.quiz_room_questions
    (room_id, question_id, question_text, choices, correct_index, time_limit, order_num)
    select p_room_id, qs.id, qs.question_text, qs.choices, qs.correct_choice_index,
      30, row_number() over ()
    from (select * from public.questions where pool = 'arena'
      and difficulty::text = r.difficulty and review_status = 'published'
      order by random() limit r.question_count) qs;
  get diagnostics seeded = row_count;
  if seeded <> r.question_count then raise exception 'Not enough questions available at this difficulty.'; end if;
  update public.quiz_rooms set status = 'starting', current_question = 1,
    starts_at = clock_timestamp() + interval '5 seconds', finished_at = null
    where id = p_room_id;
end;
$function$;
