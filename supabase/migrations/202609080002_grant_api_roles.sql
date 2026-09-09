-- Tables created through the SQL editor do not automatically grant PostgREST
-- roles access. RLS policies still enforce what authenticated users can do;
-- service_role is used only by server-side Google Sheet import jobs.
grant usage on schema public to anon, authenticated, service_role;

grant select on table public.profiles, public.events, public.candidates, public.queue_tickets, public.audit_logs, public.google_sheet_connections to authenticated;
grant insert, update, delete on table public.profiles, public.events, public.candidates, public.queue_tickets, public.audit_logs, public.google_sheet_connections to authenticated;

grant all privileges on table public.profiles, public.events, public.candidates, public.queue_tickets, public.audit_logs, public.google_sheet_connections to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant execute on function public.check_in_candidate(uuid, uuid) to authenticated;
