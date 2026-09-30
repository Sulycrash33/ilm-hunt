-- A safe column list must also respect room membership. The original view
-- ran with its owner's privileges and bypassed the base table's RLS.
alter view public.quiz_room_questions_safe set (security_invoker = true);
revoke all on public.quiz_room_questions_safe from public, anon;
grant select on public.quiz_room_questions_safe to authenticated;

-- These helpers are called by trusted database code, never by a player.
-- Revoking EXECUTE does not prevent a table trigger from firing, and an
-- enclosing SECURITY DEFINER function still calls them as its owner.
revoke all on function public.enqueue_question_translations(uuid)
  from public, anon, authenticated;
revoke all on function public.translation_rejection_reason(uuid, text, jsonb)
  from public, anon, authenticated;

-- Include triggers added after 0028/0038 without weakening legitimate RPCs.
do $$
declare
  helper regprocedure;
begin
  for helper in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', helper);
  end loop;
end;
$$;

-- Abort rather than deploy an ineffective grant change.
do $$
begin
  if has_table_privilege('anon', 'public.quiz_room_questions_safe', 'SELECT')
     or has_function_privilege('anon', 'public.enqueue_question_translations(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enqueue_question_translations(uuid)', 'EXECUTE') then
    raise exception 'Internal multiplayer/translation access is still public';
  end if;
  if has_column_privilege('authenticated', 'public.quiz_room_questions', 'correct_index', 'SELECT') then
    raise exception 'The multiplayer answer key is still readable';
  end if;
end;
$$;
