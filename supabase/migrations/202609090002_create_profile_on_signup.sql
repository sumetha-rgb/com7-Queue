-- Create an application profile whenever Supabase Auth creates a user.
-- This deployment is restricted to staff administrators, so new accounts are
-- created as admins by default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'admin'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Repair Auth users created before this migration.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  'admin'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
