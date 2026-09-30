-- Room transitions and timers must commit together. No answer keys are returned.
create or replace function public.start_multiplayer_quiz_rpc(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
$$;

create or replace function public.begin_multiplayer_quiz_rpc(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.quiz_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where id = p_room_id for update;
  if r.id is null or not exists (
    select 1 from public.quiz_room_players where room_id = p_room_id and user_id = auth.uid()
  ) then raise exception 'You are not a participant in this room.'; end if;
  if r.status = 'in_progress' then return; end if;
  if r.status <> 'starting' or r.starts_at is null then raise exception 'Room is not starting.'; end if;
  if clock_timestamp() < r.starts_at then raise exception 'Countdown is still running.'; end if;
  update public.quiz_room_questions set started_at = r.starts_at
    where room_id = p_room_id and order_num = 1;
  if not found then raise exception 'First question not found.'; end if;
  update public.quiz_rooms set status = 'in_progress', current_question = 1 where id = p_room_id;
end;
$$;

create or replace function public.advance_multiplayer_question_rpc(p_room_id uuid, p_expected_question integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  r public.quiz_rooms%rowtype;
  next_num integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Room not found.'; end if;
  if r.host_id <> auth.uid() then raise exception 'Only the host can advance the quiz.'; end if;
  if r.status = 'finished' then return true; end if;
  if r.status <> 'in_progress' then raise exception 'Quiz has not started.'; end if;
  if p_expected_question is null then raise exception 'Current question is required.'; end if;
  -- A retried click/network request cannot skip another question.
  if r.current_question <> p_expected_question then return false; end if;
  next_num := r.current_question + 1;
  if next_num > r.question_count then
    update public.quiz_rooms set status = 'finished', finished_at = clock_timestamp() where id = p_room_id;
    return true;
  end if;
  update public.quiz_room_questions set started_at = clock_timestamp()
    where room_id = p_room_id and order_num = next_num;
  if not found then raise exception 'Next question not found.'; end if;
  update public.quiz_rooms set current_question = next_num where id = p_room_id;
  return false;
end;
$$;

-- Grade only the active question, against server time. A retry returns the
-- existing result without awarding more points, even if its response was lost.
create or replace function public.submit_multiplayer_answer_rpc(
  p_room_id uuid, p_question_id uuid, p_selected_index integer, p_time_taken integer
)
returns table(is_correct boolean, points_earned integer)
language plpgsql security definer set search_path = public as $$
declare
  r public.quiz_rooms%rowtype;
  q public.quiz_room_questions%rowtype;
  p public.quiz_room_players%rowtype;
  a public.quiz_room_answers%rowtype;
  elapsed integer;
  correct boolean;
  points integer;
  new_streak integer;
  bonus integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into r from public.quiz_rooms where id = p_room_id for update;
  select * into p from public.quiz_room_players where room_id = p_room_id and user_id = auth.uid() for update;
  if r.id is null or p.id is null then raise exception 'You are not a participant in this room.'; end if;
  select * into q from public.quiz_room_questions where id = p_question_id and room_id = p_room_id;
  if q.id is null then raise exception 'Question not found in this room.'; end if;
  select * into a from public.quiz_room_answers where room_id = p_room_id
    and question_id = p_question_id and user_id = auth.uid();
  if a.id is not null then
    elapsed := greatest(0, floor(extract(epoch from (a.answered_at - q.started_at)))::integer);
    return query select a.is_correct, case when a.is_correct then greatest(100 - elapsed * 2, 10) else 0 end;
    return;
  end if;
  if r.status <> 'in_progress' or q.order_num <> r.current_question or q.started_at is null then
    raise exception 'This question is not active.';
  end if;
  if clock_timestamp() < q.started_at or clock_timestamp() >= q.started_at + make_interval(secs => q.time_limit) then
    raise exception 'Time is up for this question.';
  end if;
  if p_selected_index is null or p_selected_index < 0 or p_selected_index >= jsonb_array_length(q.choices) then
    raise exception 'Invalid answer choice.';
  end if;
  elapsed := greatest(0, floor(extract(epoch from (clock_timestamp() - q.started_at)))::integer);
  correct := p_selected_index = q.correct_index;
  points := case when correct then greatest(100 - elapsed * 2, 10) else 0 end;
  new_streak := case when correct then p.streak + 1 else 0 end;
  bonus := case when correct and new_streak >= 3 then (new_streak / 3) * 5 else 0 end;
  insert into public.quiz_room_answers(room_id, question_id, user_id, selected_index, is_correct, time_taken, answered_at)
    values(p_room_id, p_question_id, auth.uid(), p_selected_index, correct, elapsed, q.started_at + make_interval(secs => elapsed));
  update public.quiz_room_players set score = p.score + points + bonus,
    correct_answers = p.correct_answers + case when correct then 1 else 0 end,
    total_answers = p.total_answers + 1, streak = new_streak where id = p.id;
  return query select correct, points;
end;
$$;

revoke all on function public.begin_multiplayer_quiz_rpc(uuid) from public, anon;
revoke all on function public.start_multiplayer_quiz_rpc(uuid) from public, anon;
revoke all on function public.advance_multiplayer_question_rpc(uuid, integer) from public, anon;
revoke all on function public.submit_multiplayer_answer_rpc(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.begin_multiplayer_quiz_rpc(uuid) to authenticated;
grant execute on function public.start_multiplayer_quiz_rpc(uuid) to authenticated;
grant execute on function public.advance_multiplayer_question_rpc(uuid, integer) to authenticated;
grant execute on function public.submit_multiplayer_answer_rpc(uuid, uuid, integer, integer) to authenticated;

-- Clients can change readiness, but scores belong to the grading function.
revoke insert, update on public.quiz_room_players from anon, authenticated;
grant insert (room_id, user_id, is_ready, is_host) on public.quiz_room_players to authenticated;
grant update (is_ready) on public.quiz_room_players to authenticated;
revoke insert, update, delete on public.quiz_room_answers from anon, authenticated;
drop policy if exists "Room participants can view answers" on public.quiz_room_answers;
create policy "Players can view their own submitted answers" on public.quiz_room_answers
  for select to authenticated using (user_id = (select auth.uid()));
