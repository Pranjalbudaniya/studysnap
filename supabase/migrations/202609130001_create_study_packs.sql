-- StudySnap: Create study_packs table with Row Level Security (RLS)
-- This table stores generated study-pack metadata and structured revision/quiz JSON.
-- It does not store original uploaded PDFs/files or raw extracted text.

create table if not exists public.study_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_file_name text,
  subject text,
  note_style text,
  difficulty text,
  notes_json jsonb,
  quiz_json jsonb,
  review_flags jsonb not null default '[]'::jsonb,
  recall_progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.study_packs enable row level security;

-- RLS Policies: Every user can only manage their own study packs
create policy "Users can view their own study packs"
  on public.study_packs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own study packs"
  on public.study_packs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own study packs"
  on public.study_packs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own study packs"
  on public.study_packs
  for delete
  using (auth.uid() = user_id);

-- Safe updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger
drop trigger if exists set_study_packs_updated_at on public.study_packs;
create trigger set_study_packs_updated_at
  before update on public.study_packs
  for each row
  execute function public.handle_updated_at();
