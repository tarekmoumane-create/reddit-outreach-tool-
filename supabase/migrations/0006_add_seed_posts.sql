-- Operator-triggered "seed posts": a Reddit post that fits a subreddit's tone
-- and the brand's niche, plus three candidate comments (two organic, one with
-- a casual brand plug). The operator picks a target subreddit, generates a
-- bundle, and copy/pastes manually. Status tracks whether they actually
-- posted it so historical bundles are reviewable.

create table if not exists public.seed_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subreddit text not null,
  post_title text not null,
  post_body text not null,
  comment_organic_1 text not null,
  comment_organic_2 text not null,
  comment_plug text not null,
  status text not null default 'draft' check (status in ('draft','posted','skipped')),
  created_at timestamptz not null default now()
);

create index if not exists seed_posts_client_created_idx
  on public.seed_posts(client_id, created_at desc);

alter table public.seed_posts enable row level security;

drop policy if exists "seed_posts_select_own" on public.seed_posts;
create policy "seed_posts_select_own" on public.seed_posts
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = seed_posts.client_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "seed_posts_update_own" on public.seed_posts;
create policy "seed_posts_update_own" on public.seed_posts
  for update using (
    exists (
      select 1 from public.clients c
      where c.id = seed_posts.client_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.clients c
      where c.id = seed_posts.client_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "seed_posts_delete_own" on public.seed_posts;
create policy "seed_posts_delete_own" on public.seed_posts
  for delete using (
    exists (
      select 1 from public.clients c
      where c.id = seed_posts.client_id and c.user_id = auth.uid()
    )
  );

-- Inserts come from server-side code using the service role key (which
-- bypasses RLS), matching the pattern used by runs/opportunities. No insert
-- policy is needed for end users.
