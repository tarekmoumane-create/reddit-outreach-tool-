-- Reddit Outreach Tool — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` once the CLI is set up.

------------------------------------------------------------
-- Extensions
------------------------------------------------------------
create extension if not exists "pgcrypto";

------------------------------------------------------------
-- Tables
------------------------------------------------------------

-- Clients (the brands an operator services)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  description text,
  extra_keywords text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_active_idx on public.clients(active) where active = true;

-- Daily job runs, one row per client per day
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  run_date date not null,
  status text not null default 'pending' check (status in ('pending','success','failed','partial')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists runs_client_date_idx on public.runs(client_id, run_date);
create index if not exists runs_client_id_idx on public.runs(client_id);

-- Individual Reddit post opportunities
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  reddit_post_id text not null,
  subreddit text not null,
  title text not null,
  permalink text not null,
  post_date timestamptz not null,
  upvotes integer not null default 0,
  comment_count integer not null default 0,
  relevance_score integer not null,
  why_it_fits text not null,
  generated_comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists opportunities_client_run_idx on public.opportunities(client_id, run_id);
create index if not exists opportunities_client_post_date_idx on public.opportunities(client_id, post_date desc);

-- Dedup memory: posts already delivered to each client
create table if not exists public.seen_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  reddit_post_id text not null,
  first_seen_at timestamptz not null default now(),
  unique (client_id, reddit_post_id)
);

create index if not exists seen_posts_client_idx on public.seen_posts(client_id);

------------------------------------------------------------
-- updated_at trigger for clients
------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

------------------------------------------------------------
-- Row-Level Security
-- Operators can only read/write their own clients and the related rows.
-- Server-side code using the SERVICE ROLE key bypasses RLS for cron jobs.
------------------------------------------------------------

alter table public.clients       enable row level security;
alter table public.runs          enable row level security;
alter table public.opportunities enable row level security;
alter table public.seen_posts    enable row level security;

-- clients: operator owns their rows
drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own" on public.clients
  for select using (auth.uid() = user_id);

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own" on public.clients
  for insert with check (auth.uid() = user_id);

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own" on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own" on public.clients
  for delete using (auth.uid() = user_id);

-- runs: readable if you own the parent client
drop policy if exists "runs_select_own" on public.runs;
create policy "runs_select_own" on public.runs
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = runs.client_id and c.user_id = auth.uid()
    )
  );

-- opportunities: readable if you own the parent client
drop policy if exists "opportunities_select_own" on public.opportunities;
create policy "opportunities_select_own" on public.opportunities
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = opportunities.client_id and c.user_id = auth.uid()
    )
  );

-- seen_posts: readable if you own the parent client (rarely queried from UI, but keep consistent)
drop policy if exists "seen_posts_select_own" on public.seen_posts;
create policy "seen_posts_select_own" on public.seen_posts
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = seen_posts.client_id and c.user_id = auth.uid()
    )
  );

-- Note: runs, opportunities, seen_posts have NO insert/update/delete policies for
-- regular users. Writes are only performed by the cron workers via the service role
-- key, which bypasses RLS.
