-- Two flavors of seed post:
--
--   'organic'   (default, the existing behavior) — the planted post does NOT
--               mention the brand. The brand mention rides in via the third
--               comment ("plug"). Used when the goal is to make the seed look
--               like a regular sub conversation.
--
--   'brand_led' (new) — the planted post IS about the brand. First-person
--               review, "anyone else tried X", honest-take-after-N-months,
--               etc. The three comments support / question / nuance the post
--               so the thread looks like real engagement.
--
-- Existing rows are 'organic' to preserve current behavior.

alter table public.seed_posts
  add column if not exists style text not null default 'organic'
  check (style in ('organic', 'brand_led'));

create index if not exists seed_posts_style_idx
  on public.seed_posts(style);
