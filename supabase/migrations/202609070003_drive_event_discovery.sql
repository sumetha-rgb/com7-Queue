alter table public.google_sheet_connections add column if not exists drive_file_id text unique;
create index if not exists events_date_status_idx on public.events(event_date, status);
