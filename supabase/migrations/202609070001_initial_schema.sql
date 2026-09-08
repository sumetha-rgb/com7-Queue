create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'interviewer', 'viewer');
create type public.event_status as enum ('draft', 'active', 'closed');
create type public.employee_category as enum ('พนักงานหน้าร้าน', 'ออฟฟิศ');
create type public.check_in_status as enum ('ยังไม่เช็คชื่อ', 'เช็คชื่อแล้ว', 'ไม่เข้าร่วม');
create type public.interview_status as enum ('ยังไม่สัมภาษณ์', 'สัมภาษณ์แล้ว', 'ไม่เข้าร่วม');
create type public.email_status as enum ('pending', 'sent', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'viewer',
  avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(), name text not null, event_date date not null,
  location text, description text, status public.event_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(), interview_id text not null unique,
  full_name text not null, phone_number text, email text, position_applied text,
  employee_category public.employee_category not null, interview_date date,
  interview_period text, event_id uuid not null references public.events(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.queue_tickets (
  id uuid primary key default gen_random_uuid(), candidate_id uuid not null unique references public.candidates(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  employee_category public.employee_category not null, queue_no integer not null check (queue_no > 0),
  check_in_status public.check_in_status not null default 'เช็คชื่อแล้ว',
  interview_status public.interview_status not null default 'ยังไม่สัมภาษณ์',
  checked_in_at timestamptz not null default now(), checked_in_by uuid references public.profiles(id),
  email_status public.email_status not null default 'pending', email_sent_at timestamptz, email_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(event_id, employee_category, queue_no)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
  action text not null, entity_type text not null, entity_id uuid not null,
  old_value jsonb, new_value jsonb, metadata jsonb, created_at timestamptz not null default now()
);

create index candidates_event_id_idx on public.candidates(event_id);
create index candidates_full_name_idx on public.candidates(full_name);
create index candidates_phone_number_idx on public.candidates(phone_number);
create index candidates_email_idx on public.candidates(email);
create index queue_tickets_event_category_idx on public.queue_tickets(event_id, employee_category);
create index queue_tickets_check_in_status_idx on public.queue_tickets(check_in_status);
create index queue_tickets_interview_status_idx on public.queue_tickets(interview_status);
create index queue_tickets_created_at_idx on public.queue_tickets(created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger candidates_updated_at before update on public.candidates for each row execute function public.set_updated_at();
create trigger queue_tickets_updated_at before update on public.queue_tickets for each row execute function public.set_updated_at();

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.check_in_candidate(p_candidate_id uuid, p_admin_id uuid)
returns public.queue_tickets language plpgsql security definer set search_path = public as $$
declare v_candidate public.candidates; v_ticket public.queue_tickets; v_queue_no integer;
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
  perform pg_advisory_xact_lock(hashtext(v_candidate.event_id::text || ':' || v_candidate.employee_category::text));
  select coalesce(max(queue_no), 0) + 1 into v_queue_no from public.queue_tickets
    where event_id = v_candidate.event_id and employee_category = v_candidate.employee_category;
  insert into public.queue_tickets(candidate_id,event_id,employee_category,queue_no,checked_in_by)
    values(p_candidate_id,v_candidate.event_id,v_candidate.employee_category,v_queue_no,p_admin_id) returning * into v_ticket;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_value)
    values(p_admin_id,'check_in','queue_ticket',v_ticket.id,to_jsonb(v_ticket));
  return v_ticket;
end; $$;

grant execute on function public.check_in_candidate(uuid, uuid) to authenticated;

alter table public.profiles enable row level security; alter table public.events enable row level security;
alter table public.candidates enable row level security; alter table public.queue_tickets enable row level security; alter table public.audit_logs enable row level security;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid() or public.current_role() = 'admin');
create policy "events readable" on public.events for select to authenticated using (true);
create policy "events admin write" on public.events for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "candidates readable" on public.candidates for select to authenticated using (true);
create policy "candidates admin write" on public.candidates for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "tickets readable" on public.queue_tickets for select to authenticated using (true);
create policy "tickets admin interviewer update" on public.queue_tickets for update to authenticated using (public.current_role() in ('admin','interviewer')) with check (public.current_role() in ('admin','interviewer'));
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.current_role() = 'admin');
create policy "audit staff insert" on public.audit_logs for insert to authenticated with check (actor_id = auth.uid() and public.current_role() in ('admin','interviewer'));

alter publication supabase_realtime add table public.queue_tickets;
