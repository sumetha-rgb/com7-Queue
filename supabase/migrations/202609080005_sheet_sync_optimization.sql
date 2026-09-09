alter table public.google_sheet_connections
  add column if not exists source_hash text;
alter table public.google_sheet_connections
  add column if not exists sync_lock_until timestamptz;

create or replace function public.try_lock_sheet_sync(p_connection_id uuid, p_lock_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.google_sheet_connections
  set sync_lock_until = now() + make_interval(secs => greatest(p_lock_seconds, 10))
  where id = p_connection_id and (sync_lock_until is null or sync_lock_until < now());
  return found;
end; $$;

grant execute on function public.try_lock_sheet_sync(uuid, integer) to service_role;