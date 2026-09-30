-- HTTP 200 does not mean the translation worker wrote anything. Surface the
-- most recent retained batch summary, gated to admins like the queue RPCs.
create or replace function public.admin_translation_worker_status()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  response record;
  summary jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  select r.created, r.status_code, r.content into response
    from net._http_response r
   where r.content like '%"rateLimited"%'
     and r.content like '%"claimed"%'
   order by r.created desc
   limit 1;
  if not found then return null; end if;
  summary := response.content::jsonb;
  return jsonb_build_object(
    'observed_at', response.created,
    'http_status', response.status_code,
    'claimed', summary->'claimed',
    'written', summary->'written',
    'rate_limited', summary->'rateLimited',
    'failed', summary->'failed'
  );
end;
$$;
revoke all on function public.admin_translation_worker_status() from public, anon;
grant execute on function public.admin_translation_worker_status() to authenticated;
