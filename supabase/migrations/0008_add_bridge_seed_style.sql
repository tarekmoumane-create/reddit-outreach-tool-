-- Third seed-post style: 'bridge'.
--
-- Where 'organic' plants a discussion in the brand's niche (no brand) and
-- 'brand_led' writes a post that's overtly about the brand, 'bridge' is
-- aimed at people who are NOT already in the brand's category. The post
-- leads with a mainstream pain or curiosity those readers already feel
-- (e.g. ISP price hikes for a community-ISP brand), gently floats the
-- broader category as a possible answer, and names the brand at most
-- once as "a project trying this" — never a recommendation. Recruitment
-- INTO the niche, not conversion.
--
-- 0007 added the column with an inline CHECK constraint allowing only
-- 'organic' and 'brand_led'. Postgres auto-named that constraint
-- 'seed_posts_style_check'. Drop and re-add it to permit 'bridge'.

alter table public.seed_posts
  drop constraint if exists seed_posts_style_check;

alter table public.seed_posts
  add constraint seed_posts_style_check
  check (style in ('organic', 'brand_led', 'bridge'));
