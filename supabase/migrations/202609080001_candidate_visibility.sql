alter table public.candidates add column if not exists is_visible boolean not null default true;
alter table public.candidates add column if not exists visibility_updated_at timestamptz;
alter table public.candidates add column if not exists visibility_updated_by uuid references public.profiles(id);
