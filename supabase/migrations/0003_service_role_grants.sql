-- Required so the Next.js server (service_role key) can read/write app tables.
-- Run in Supabase SQL Editor after 0001_init.sql.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

grant all on storage.buckets to service_role;
grant all on storage.objects to service_role;
grant select on storage.buckets to anon, authenticated;
grant select on storage.objects to anon, authenticated;
