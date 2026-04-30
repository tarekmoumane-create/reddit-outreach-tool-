-- Per-client monthly volume target and daily safety cap.
-- The pipeline computes today's quota from these on every run:
--   today_quota = ceil((monthly_target - delivered_this_month) / days_left_in_month)
--   capped at daily_cap so high-volume clients don't burst-post.

alter table public.clients
  add column if not exists monthly_target int not null default 150,
  add column if not exists daily_cap int not null default 10;

-- Helpful when the dispatcher or UI counts deliveries by client + month.
create index if not exists opportunities_client_created_idx
  on public.opportunities (client_id, created_at desc);
