-- Per-client relevance score threshold. Posts that Haiku scores at or above
-- this value get written as opportunities (with a generated comment). Default
-- 60 matches the previous hardcoded pipeline constant.

alter table public.clients
  add column if not exists score_threshold int not null default 60
    check (score_threshold >= 0 and score_threshold <= 100);
