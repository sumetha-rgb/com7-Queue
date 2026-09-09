-- Queue tickets are operational history.  A Sheet refresh may update the
-- candidate profile, but it must never move a ticket to another Event or
-- silently change the identity used to match that candidate.
create or replace function public.prevent_ticketed_candidate_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id <> old.id or new.event_id <> old.event_id or new.interview_id <> old.interview_id)
     and exists (select 1 from public.queue_tickets where candidate_id = old.id) then
    raise exception 'Cannot change Event or Interview_Id for a candidate with a queue ticket'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists candidates_preserve_ticket_identity on public.candidates;
create trigger candidates_preserve_ticket_identity
before update on public.candidates
for each row execute function public.prevent_ticketed_candidate_identity_change();

-- Deletion is already protected by queue_tickets.candidate_id ON DELETE
-- RESTRICT; this explicit policy documents the same business invariant for
-- application roles and prevents accidental candidate cleanup jobs.
create or replace function public.prevent_ticketed_candidate_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.queue_tickets where candidate_id = old.id) then
    raise exception 'Cannot delete a candidate with queue history' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists candidates_preserve_ticket_history on public.candidates;
create trigger candidates_preserve_ticket_history
before delete on public.candidates
for each row execute function public.prevent_ticketed_candidate_delete();
