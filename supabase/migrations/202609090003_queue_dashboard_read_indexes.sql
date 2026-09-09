-- Match the filters and ordering used by the initial queue dashboard load.
-- These indexes keep the API fast as candidate and ticket histories grow.
create index if not exists candidates_visible_event_created_idx
  on public.candidates (event_id, created_at desc)
  where is_visible = true;

create index if not exists queue_tickets_event_latest_idx
  on public.queue_tickets (event_id, queue_date desc, created_at desc);
