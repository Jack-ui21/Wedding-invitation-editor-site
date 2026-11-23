-- Production helper: promote an existing registered studio user to owner.
-- Run in Supabase SQL Editor after 0001_init.sql and after registering the owner account.
-- Usage: select public.promote_studio_owner('you@example.com');

create or replace function public.promote_studio_owner(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set role = 'owner'
   where lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'No studio user found for %. Register or sign in first.', p_email;
  end if;
end;
$$;

-- Only trusted server/SQL roles may promote. Never expose this to browsers.
revoke all on function public.promote_studio_owner(text) from public;
grant execute on function public.promote_studio_owner(text) to service_role;
