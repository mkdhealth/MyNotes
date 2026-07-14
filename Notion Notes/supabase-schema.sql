-- Run this once in Supabase: SQL Editor → New query → paste → Run

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.pages (id) on delete cascade,
  title text not null default 'Untitled',
  content jsonb,           -- rich text (Tiptap JSON)
  content_text text default '',  -- plain text copy, used for search & AI
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pages_user_idx on public.pages (user_id);
create index pages_parent_idx on public.pages (parent_id);

-- Row Level Security: each user sees only their own pages.
-- (When you add your team later, you can extend these policies for sharing.)
alter table public.pages enable row level security;

create policy "own pages select" on public.pages
  for select using (auth.uid() = user_id);
create policy "own pages insert" on public.pages
  for insert with check (auth.uid() = user_id);
create policy "own pages update" on public.pages
  for update using (auth.uid() = user_id);
create policy "own pages delete" on public.pages
  for delete using (auth.uid() = user_id);
