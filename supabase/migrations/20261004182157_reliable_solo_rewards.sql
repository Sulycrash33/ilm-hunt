-- Private reviewed candidate: latest main da71b4313f084b46ce96f049a934d23bbb7baea3.
-- No historical repair, content edits, or run-scoping change.

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(p_question_id uuid, p_choice_index integer, p_response_time_ms integer DEFAULT NULL::integer, p_run_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(o_correct boolean, o_correct_index integer, o_explanation text, o_citation text, o_xp_earned integer, o_streak_multiplier integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_question record;
  v_streak int := 0;
  v_correct boolean;
  v_multiplier int;
  v_base_xp int;
  v_xp int;
  v_mode_num int := 1;
  v_mode_den int := 1;
  v_double boolean := false;
  v_used_hint boolean := false;
  v_tier int;
  v_locale public.app_language;
  v_explanation text;
  rec record;
  v_first boolean;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to answer.';
  end if;
  -- Lock before ledger, inventory, streak, or first-answer reward reads.
  perform 1 from public.profiles p where p.id = v_user_id for update;
  if not found then raise exception 'Profile not found.'; end if;

  if p_choice_index is null or p_choice_index < 0 then
    raise exception 'Invalid answer.';
  end if;

  select q.id, q.choices, q.correct_choice_index, q.explanation,
         q.citation_reference, q.difficulty, q.tier, q.review_status
    into v_question
    from public.questions q
   where q.id = p_question_id;

  if not found then raise exception 'Question not found.'; end if;
  if v_question.review_status <> 'published' then
    raise exception 'This question is not available.';
  end if;

  if p_choice_index >= jsonb_array_length(v_question.choices) then
    raise exception 'Invalid answer.';
  end if;

  v_tier := least(greatest(coalesce(v_question.tier, 1), 1), 9);

  if p_run_id is not null then
    select r.xp_numerator, r.xp_denominator
      into v_mode_num, v_mode_den
      from public.game_runs g
      join public.game_mode_rules r on r.mode = g.mode
     where g.id = p_run_id
       and g.user_id = v_user_id
       and g.ended_at is null
       and (g.tier_min is null or v_tier between g.tier_min and g.tier_max);

    if not found then
      v_mode_num := 1;
      v_mode_den := 1;
    end if;
  end if;

  select exists (
    select 1 from public.lifeline_spends s
     where s.user_id = v_user_id
       and s.question_id = p_question_id
       and s.lifeline_id = 'ask-imam'
  ) into v_used_hint;

  update public.lifeline_spends s
     set consumed_at = now()
   where s.user_id = v_user_id
     and s.question_id = p_question_id
     and s.lifeline_id = 'double-points'
     and s.consumed_at is null
  returning true into v_double;

  v_double := coalesce(v_double, false);

  for rec in
    select a.is_correct
      from public.attempts a
     where a.user_id = v_user_id
       and a.is_first_answer
     order by a.created_at desc
     limit 20
  loop
    exit when not rec.is_correct;
    v_streak := v_streak + 1;
  end loop;

  v_correct := (p_choice_index = v_question.correct_choice_index);
  if v_correct then
    v_multiplier := least(floor(v_streak / 3)::int + 1, 3);
  else
    v_multiplier := 1;
  end if;

  if not v_correct then
    v_base_xp := 0;
  else
    v_base_xp := round((20 + 5 * v_tier) / 3.0);
  end if;

  v_xp := v_base_xp * v_multiplier * (case when v_double then 2 else 1 end);
  v_xp := round((v_xp * v_mode_num)::numeric / v_mode_den);

  -- A question pays once. Answering it again is recorded -- practice,
  -- review and the round summary all depend on the attempt existing -- but
  -- it earns nothing. Checked before the insert, so it does not see the row
  -- it is about to write.
  select not exists (
    select 1 from public.attempts a
     where a.user_id = v_user_id
       and a.question_id = p_question_id
  ) into v_first;

  if not v_first then
    v_xp := 0;
    v_multiplier := 1;
  end if;

  insert into public.attempts (
    user_id, question_id, is_correct, xp_earned, response_time_ms, used_ask_the_imam_hint, is_first_answer
  )
  values (
    v_user_id, v_question.id, v_correct, v_xp, p_response_time_ms, v_used_hint, v_first
  );

  update public.profiles p
     set coins      = coalesce(p.coins, 0) + v_xp,
         total_xp   = coalesce(p.total_xp, 0) + v_xp,
         high_score = greatest(coalesce(p.high_score, 0), coalesce(p.total_xp, 0) + v_xp)
   where p.id = v_user_id;

  select p.preferred_language into v_locale
    from public.profiles p where p.id = v_user_id;

  v_explanation := v_question.explanation;

  if v_locale is not null and v_locale <> 'en' then
    select coalesce(nullif(btrim(t.explanation), ''), v_question.explanation)
      into v_explanation
      from public.question_translations t
     where t.question_id = p_question_id
       and t.locale = v_locale;

    v_explanation := coalesce(v_explanation, v_question.explanation);
  end if;

  return query
    select v_correct,
           v_question.correct_choice_index::int,
           v_explanation,
           v_question.citation_reference,
           v_xp,
           v_multiplier;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.spend_lifeline_rpc(p_lifeline_id text, p_question_id uuid DEFAULT NULL::uuid, p_run_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(success boolean, error text, new_balance integer, cost integer, paid_with text, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_cost int;
  v_item_id text;
  v_remaining int;
  v_new_balance int;
  v_paid_with text;
  v_charged int;
begin
  if v_user_id is null then
    return query select false, 'You must be signed in.'::text, null::int, null::int, null::text, null::int;
    return;
  end if;

  -- Lock before ledger, inventory, streak, or first-answer reward reads.
  perform 1 from public.profiles p where p.id = v_user_id for update;
  if not found then raise exception 'Profile not found.'; end if;

  select lp.cost into v_cost
  from public.lifeline_prices lp
  where lp.id = p_lifeline_id and lp.enabled;

  if v_cost is null then
    return query select false, 'Unknown lifeline.'::text, null::int, null::int, null::text, null::int;
    return;
  end if;

  if p_question_id is not null
     and not exists (
       select 1 from public.questions q
        where q.id = p_question_id and q.review_status = 'published'
     ) then
    return query select false, 'Question not found.'::text, null::int, null::int, null::text, null::int;
    return;
  end if;

  if p_question_id is not null
     and exists (
       select 1 from public.lifeline_spends s
        where s.user_id = v_user_id
          and s.question_id = p_question_id
          and s.lifeline_id = p_lifeline_id
     ) then
    select p.coins into v_new_balance from public.profiles p where p.id = v_user_id;
    return query select true, null::text, v_new_balance, 0, 'already'::text, 0;
    return;
  end if;

  -- Existing paid retries above remain valid; new purchases need a usable effect.
  if p_lifeline_id = 'fifty-fifty' and (
    p_question_id is null or not exists (
      select 1 from public.questions q where q.id = p_question_id
        and q.review_status = 'published'
        and jsonb_typeof(q.choices) = 'array'
        and case when jsonb_typeof(q.choices) = 'array'
                 then jsonb_array_length(q.choices) >= 3 else false end
        and q.correct_choice_index >= 0
        and case when jsonb_typeof(q.choices) = 'array'
                 then q.correct_choice_index < jsonb_array_length(q.choices) else false end
    )
  ) then
    return query select false, 'Fifty-fifty unavailable for this question.'::text,
      p.coins, v_cost, null::text, 0 from public.profiles p where p.id = v_user_id;
    return;
  end if;

  select si.id into v_item_id
  from public.store_items si
  where si.lifeline_id = p_lifeline_id
  limit 1;

  if v_item_id is not null then
    update public.user_inventory ui
       set quantity = ui.quantity - 1,
           updated_at = now()
     where ui.user_id = v_user_id
       and ui.item_id = v_item_id
       and ui.quantity > 0
    returning ui.quantity into v_remaining;
  end if;

  if v_remaining is not null then
    select p.coins into v_new_balance from public.profiles p where p.id = v_user_id;
    v_paid_with := 'inventory';
    v_charged := 0;
  else
    update public.profiles p
       set coins = p.coins - v_cost
     where p.id = v_user_id
       and p.coins >= v_cost
    returning p.coins into v_new_balance;

    if v_new_balance is null then
      select p.coins into v_new_balance from public.profiles p where p.id = v_user_id;
      return query select false, 'Not enough coins.'::text, v_new_balance, v_cost, null::text, 0;
      return;
    end if;

    v_paid_with := 'coins';
    v_charged := v_cost;
    v_remaining := 0;
  end if;

  if p_question_id is not null then
    insert into public.lifeline_spends (user_id, lifeline_id, question_id, run_id)
    values (v_user_id, p_lifeline_id, p_question_id, p_run_id);
  end if;

  return query select true, null::text, v_new_balance, v_charged, v_paid_with, v_remaining;
end;
$function$
;

-- Readable by the owner under the existing ledger RLS; no new write grants.
alter table public.lifeline_spends add column if not exists fifty_fifty_indices integer[];

create or replace function public.fifty_fifty_choices(p_question_id uuid)
returns int[] language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_spend_id uuid;
  v_indices integer[];
  v_correct int;
  v_total int;
begin
  if u is null then raise exception 'You must be signed in.'; end if;
  -- All three RPCs acquire the caller profile before any ledger row lock.
  perform 1 from public.profiles p where p.id = u for update;
  if not found then raise exception 'Profile not found.'; end if;
  select s.id, s.fifty_fifty_indices into v_spend_id, v_indices
    from public.lifeline_spends s
    where s.user_id = u and s.question_id = p_question_id
      and s.lifeline_id = 'fifty-fifty'
    for update;
  if not found then raise exception 'Purchase fifty-fifty for this question first.'; end if;

  select correct_choice_index, jsonb_array_length(choices)
    into v_correct, v_total from public.questions
    where id = p_question_id and review_status = 'published';
  if v_correct is null then raise exception 'Question not found.'; end if;
  if v_total < 3 or v_correct < 0 or v_correct >= v_total then
    raise exception 'Fifty-fifty unavailable for this question.';
  end if;
  if v_indices is not null then
    -- Do not regenerate after content changes: that would expose additional exclusions.
    if cardinality(v_indices) <> least(2, v_total - 2)
       or (select count(distinct x) from unnest(v_indices) x) <> cardinality(v_indices)
       or exists(select 1 from unnest(v_indices) x
                 where x is null or x < 0 or x >= v_total or x = v_correct) then
      raise exception 'Fifty-fifty unavailable for this question.';
    end if;
    return v_indices;
  end if;
  v_indices := array(
    select x from generate_series(0, v_total - 1) x
    where x <> v_correct order by random() limit least(2, v_total - 2)
  );
  update public.lifeline_spends set fifty_fifty_indices = v_indices where id = v_spend_id;
  return v_indices;
end;
$$;

revoke all on function public.submit_quiz_answer(uuid,integer,integer,uuid) from public,anon;
revoke all on function public.spend_lifeline_rpc(text,uuid,uuid) from public,anon;
revoke all on function public.fifty_fifty_choices(uuid) from public,anon;
grant execute on function public.submit_quiz_answer(uuid,integer,integer,uuid),
  public.spend_lifeline_rpc(text,uuid,uuid),public.fifty_fifty_choices(uuid) to authenticated;

-- Attempts and their derived-state triggers must only receive trusted RPC writes.
drop policy if exists "Users can insert their own attempts" on public.attempts;
revoke insert on public.attempts from public, anon, authenticated;
do $$
declare col record;
begin
  for col in select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'attempts'
  loop
    execute format('revoke insert (%I) on public.attempts from public, anon, authenticated', col.column_name);
  end loop;
end;
$$;
