-- Run manually in Supabase SQL Editor after reviewing the preview query.
-- This removes only duplicate active Events that have no candidates.
-- Events with candidates or queue history are kept and closed instead.
begin;

create temporary table duplicate_event_cleanup on commit drop as
with event_stats as (
  select
    e.id,
    e.name,
    e.event_date,
    count(distinct c.id) as candidate_count,
    count(distinct q.id) as ticket_count,
    min(e.created_at) as created_at
  from public.events e
  left join public.candidates c on c.event_id = e.id
  left join public.queue_tickets q on q.event_id = e.id
  where e.status = 'active'
  group by e.id, e.name, e.event_date
), ranked as (
  select
    *,
    row_number() over (
      partition by event_date, lower(trim(name))
      order by candidate_count desc, ticket_count desc, created_at asc, id
    ) as duplicate_rank
  from event_stats
)
select * from ranked where duplicate_rank > 1;

-- Preview before changing anything.
select id, name, event_date, candidate_count, ticket_count, duplicate_rank
from duplicate_event_cleanup
order by event_date, name, duplicate_rank;

-- Empty duplicates are safe to remove. Their connection is removed first.
delete from public.google_sheet_connections connection
using duplicate_event_cleanup duplicate
where connection.event_id = duplicate.id
  and duplicate.candidate_count = 0
  and duplicate.ticket_count = 0;

delete from public.events event
using duplicate_event_cleanup duplicate
where event.id = duplicate.id
  and duplicate.candidate_count = 0
  and duplicate.ticket_count = 0;

-- Duplicates containing data are retained for history but hidden from the queue.
update public.events event
set status = 'closed'
from duplicate_event_cleanup duplicate
where event.id = duplicate.id
  and (duplicate.candidate_count > 0 or duplicate.ticket_count > 0);

commit;

-- Do not add a global unique constraint on event name/date: different real
-- interview sessions can legitimately share a display name. The application
-- already reuses an existing Sheet connection by Google Sheet ID.
