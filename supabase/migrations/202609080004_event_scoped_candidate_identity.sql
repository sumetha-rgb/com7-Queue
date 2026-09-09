alter table public.candidates
  drop constraint if exists candidates_interview_id_key;
alter table public.candidates
  drop constraint if exists candidates_event_interview_id_key;

alter table public.candidates
  add constraint candidates_event_interview_id_key unique(event_id, interview_id);