alter table public.queue_tickets
  add column if not exists queue_date date not null default current_date;

drop index if exists public.queue_tickets_event_category_idx;
create index if not exists queue_tickets_event_category_date_idx
  on public.queue_tickets(event_id, employee_category, queue_date);

alter table public.queue_tickets
  drop constraint if exists queue_tickets_event_category_queue_no_key;
alter table public.queue_tickets
  drop constraint if exists queue_tickets_event_category_date_queue_no_key;
alter table public.queue_tickets
  add constraint queue_tickets_event_category_date_queue_no_key
  unique(event_id, employee_category, queue_date, queue_no);

create or replace function public.check_in_candidate(p_candidate_id uuid, p_admin_id uuid)
returns public.queue_tickets language plpgsql security definer set search_path = public as $$
declare v_candidate public.candidates; v_ticket public.queue_tickets; v_queue_no integer; v_queue_date date := current_date;
begin
  if auth.uid() is null or auth.uid() <> p_admin_id or public.current_role() <> 'admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_candidate from public.candidates where id = p_candidate_id for update;
  if not found then raise exception 'candidate not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.events where id = v_candidate.event_id and status = 'active') then
    raise exception 'event is not active' using errcode = 'P0001';
  end if;
  select * into v_ticket from public.queue_tickets where candidate_id = p_candidate_id;
  if found then return v_ticket; end if;
  perform pg_advisory_xact_lock(hashtext(v_candidate.event_id::text || ':' || v_candidate.employee_category::text || ':' || v_queue_date::text));
  select coalesce(max(queue_no), 0) + 1 into v_queue_no from public.queue_tickets
    where event_id = v_candidate.event_id and employee_category = v_candidate.employee_category and queue_date = v_queue_date;
  insert into public.queue_tickets(candidate_id,event_id,employee_category,queue_date,queue_no,checked_in_by)
    values(p_candidate_id,v_candidate.event_id,v_candidate.employee_category,v_queue_date,v_queue_no,p_admin_id) returning * into v_ticket;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_value)
    values(p_admin_id,'check_in','queue_ticket',v_ticket.id,to_jsonb(v_ticket));
  return v_ticket;
end; $$;

grant execute on function public.check_in_candidate(uuid, uuid) to authenticated;