-- Service-role-only source for the arena importer. No client Storage policy.
insert into storage.buckets (id, name, public)
values ('content-banks', 'content-banks', false)
on conflict (id) do update set public = false;
