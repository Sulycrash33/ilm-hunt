-- Run AFTER the four 20260930 migrations inside a transaction. This file
-- creates disposable fixtures and always rolls them back. Never omit ROLLBACK.
-- When rehearsing migrations, put BEGIN and their SQL before this file.
begin;
create temp table qa_context as
select gen_random_uuid() as actor, gen_random_uuid() as other_actor,
       gen_random_uuid() as room_a, gen_random_uuid() as room_b,
       (select id from public.questions where pool = 'category' and review_status = 'published' limit 1) as question;
grant select on qa_context to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
select actor, actor::text || '@example.invalid', '{"display_name":"QA learner"}', '{}' from qa_context
union all
select other_actor, other_actor::text || '@example.invalid', '{"display_name":"QA other"}', '{}' from qa_context;

update public.profiles set coins = 500, total_xp = 500 where id = (select actor from qa_context);
update public.profiles set coins = 900, total_xp = 900 where id = (select other_actor from qa_context);
insert into public.quiz_rooms (id, code, host_id, host_name)
select room_a, upper(left(room_a::text, 6)), actor, 'ignored' from qa_context
union all
select room_b, upper(left(room_b::text, 6)), other_actor, 'ignored' from qa_context;
insert into public.quiz_room_players (room_id, user_id, user_name, is_host)
select room_a, actor, 'ignored', true from qa_context
union all select room_b, other_actor, 'ignored', true from qa_context;
insert into public.quiz_room_questions (room_id, question_id, question_text, choices, correct_index, order_num)
select rooms.room_id, q.id, q.question_text, q.choices, q.correct_choice_index, 1
from qa_context c join public.questions q on q.id = c.question
cross join lateral (values(c.room_a), (c.room_b)) rooms(room_id);
insert into public.game_runs (user_id, mode)
select actor, 'practice' from qa_context union all select other_actor, 'practice' from qa_context;
insert into public.lifeline_spends (user_id, lifeline_id, question_id)
select actor, 'time-boost', question from qa_context union all select other_actor, 'time-boost', question from qa_context;
insert into public.user_chests (user_id, tier)
select actor, (select tier from public.chest_types limit 1) from qa_context
union all select other_actor, (select tier from public.chest_types limit 1) from qa_context;

set local role anon;
do $$
begin
  begin
    perform count(*) from public.quiz_room_questions_safe;
    raise exception 'Anonymous caller read multiplayer questions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enqueue_question_translations((select question from qa_context));
    raise exception 'Anonymous caller invoked the internal translation helper';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true) from qa_context;
set local role authenticated;
do $$
begin
  if (select count(*) from public.quiz_room_questions_safe where room_id = (select room_a from qa_context)) <> 1 then
    raise exception 'A participant cannot read their own room';
  end if;
  if exists (select 1 from public.quiz_room_questions_safe where room_id = (select room_b from qa_context)) then
    raise exception 'A participant read a different room';
  end if;
  begin
    perform correct_index from public.quiz_room_questions;
    raise exception 'A participant read the answer key';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enqueue_question_translations((select question from qa_context));
    raise exception 'A player invoked the internal translation helper';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_translation_worker_status();
    raise exception 'A learner read admin worker status';
  exception when insufficient_privilege then null;
  end;
  perform public.reset_my_progress();
  perform public.reset_my_progress();
end;
$$;
reset role;

do $$
declare c record;
begin
  select * into c from qa_context;
  if exists (select 1 from public.lifeline_spends where user_id = c.actor)
     or exists (select 1 from public.user_chests where user_id = c.actor)
     or exists (select 1 from public.game_runs where user_id = c.actor) then
    raise exception 'Reset left personal game state behind';
  end if;
  if (select count(*) from public.lifeline_spends where user_id = c.other_actor) <> 1
     or (select count(*) from public.user_chests where user_id = c.other_actor) <> 1
     or (select count(*) from public.game_runs where user_id = c.other_actor) <> 1 then
    raise exception 'Reset changed another player';
  end if;
  if not exists (select 1 from public.profiles where id = c.actor and coins = 0 and total_xp = 0 and display_name = 'QA learner')
     or not exists (select 1 from public.profiles where id = c.other_actor and coins = 900 and total_xp = 900) then
    raise exception 'Reset did not preserve the intended profile boundary';
  end if;
  if (select count(*) from public.quiz_room_players where user_id = c.actor) <> 1 then
    raise exception 'Reset erased shared multiplayer history';
  end if;
  if not exists (select 1 from storage.buckets where id = 'content-banks' and not public) then
    raise exception 'The content bank bucket is not private';
  end if;
  -- The real content trigger must still be able to enqueue after its helper
  -- loses direct API access. The original question and queue are rolled back.
  update public.questions set question_text = question_text || ' [QA rollback]' where id = c.question;
  if not exists (select 1 from public.translation_queue where question_id = c.question and status = 'queued') then
    raise exception 'Content no longer queues translations';
  end if;
end;
$$;

select 'PASS: anonymous denial, room isolation, hidden answers, helper denial, admin denial, repeat reset, other-player isolation, shared-history preservation, private bucket, and content-trigger enqueue' as result;
rollback;
