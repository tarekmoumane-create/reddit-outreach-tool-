-- Adds a research-derived brand profile to each client so the scraper and
-- the scoring/comment prompts can be informed by what the company actually
-- does, who they serve, and where on Reddit their audience lives.

alter table public.clients
  add column if not exists brand_profile jsonb,
  add column if not exists profile_updated_at timestamptz;
