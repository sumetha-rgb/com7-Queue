-- Repair migration for deployments that started before the full sync/history set.
-- It is safe to run repeatedly.
alter table public.candidates
  add column if not exists source_data jsonb not null default '{}'::jsonb,
  add column if not exists is_visible boolean not null default true,
  add column if not exists visibility_updated_at timestamptz,
  add column if not exists visibility_updated_by uuid references public.profiles(id);

-- Interview_Id is unique within an Event. A global constraint prevents the same
-- person from appearing in a later Event and makes an entire Sheet import fail.
alter table public.candidates
  drop constraint if exists candidates_interview_id_key;
alter table public.candidates
  drop constraint if exists candidates_event_interview_id_key;
alter table public.candidates
  add constraint candidates_event_interview_id_key unique(event_id, interview_id);

-- Existing queue tickets are history and must survive Sheet refreshes.
create or replace function public.prevent_ticketed_candidate_identity_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.id <> old.id or new.event_id <> old.event_id or new.interview_id <> old.interview_id)
     and exists (select 1 from public.queue_tickets where candidate_id = old.id) then
    raise exception 'Cannot change Event or Interview_Id for a candidate with a queue ticket';
  end if;
  return new;
end;
$$;

drop trigger if exists candidates_preserve_ticket_identity on public.candidates;
create trigger candidates_preserve_ticket_identity
before update on public.candidates
for each row execute function public.prevent_ticketed_candidate_identity_change();

create or replace function public.prevent_ticketed_candidate_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.queue_tickets where candidate_id = old.id) then
    raise exception 'Cannot delete a candidate with queue history';
  end if;
  return old;
end;
$$;

drop trigger if exists candidates_preserve_ticket_history on public.candidates;
create trigger candidates_preserve_ticket_history
before delete on public.candidates
for each row execute function public.prevent_ticketed_candidate_delete();
