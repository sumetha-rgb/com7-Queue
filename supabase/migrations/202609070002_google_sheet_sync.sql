alter table public.candidates add column if not exists source_data jsonb not null default '{}'::jsonb;
create table if not exists public.google_sheet_connections (
  id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.events(id) on delete cascade,
  sheet_url text not null, sheet_name text, last_synced_at timestamptz, last_sync_status text not null default 'pending',
  last_sync_error text, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger google_sheet_connections_updated_at before update on public.google_sheet_connections for each row execute function public.set_updated_at();
alter table public.google_sheet_connections enable row level security;
create policy "sheet connections admin only" on public.google_sheet_connections for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
