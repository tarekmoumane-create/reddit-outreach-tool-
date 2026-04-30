-- Per-client list of subreddits to never search or surface posts from,
-- regardless of what the brand profile suggests. Operators toggle these from
-- the client edit page.

alter table public.clients
  add column if not exists excluded_subreddits text[] not null default '{}';
