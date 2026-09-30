-- Keep the existing reset contract, identity/settings and shared match history.
-- Patch its stored definition so fixes made after 0022 are preserved.
do $$
declare
  original text := pg_get_functiondef('public.reset_my_progress()'::regprocedure);
  patched text;
begin
  patched := replace(original,
    '  delete from public.attempts where user_id = uid;',
    E'  -- Serialize with other profile balance writes.\n'
    || E'  perform 1 from public.profiles where id = uid for update;\n'
    || E'  delete from public.lifeline_spends where user_id = uid;\n'
    || E'  delete from public.user_chests where user_id = uid;\n'
    || E'  delete from public.game_runs where user_id = uid;\n'
    || '  delete from public.attempts where user_id = uid;');
  if patched = original then
    raise exception 'reset_my_progress has changed: review the reset patch before applying';
  end if;
  execute patched;
end;
$$;
