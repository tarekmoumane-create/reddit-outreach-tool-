import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchRedditSearch,
  fetchSubredditNew,
  type RedditPost,
} from "@/lib/reddit/rss";
import { scorePost } from "@/lib/ai/score";
import { generateComment } from "@/lib/ai/comment";
import type { BrandProfile } from "@/lib/ai/research";

const DEFAULT_SCORE_THRESHOLD = 60;
const DEFAULT_MONTHLY_TARGET = 150;
const DEFAULT_DAILY_CAP = 10;
const MAX_POSTS_PER_CLIENT = 100;
const MAX_COMMENTS_PER_RUN = 30;
const HAIKU_PARALLELISM = 5;
const SONNET_PARALLELISM = 2;
const MAX_SUBREDDITS_PER_RUN = 15;
const POSTS_PER_SUBREDDIT = 50;
const POST_AGE_WINDOW_DAYS = 7;

type ClientRow = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  extra_keywords: string[];
  active: boolean;
  brand_profile: BrandProfile | null;
  score_threshold: number | null;
  excluded_subreddits: string[] | null;
  monthly_target: number | null;
  daily_cap: number | null;
};

type RunStats = {
  fetched: number;
  new_after_dedup: number;
  scored: number;
  above_threshold: number;
  opportunities: number;
};

export type ScoredPreview = {
  reddit_post_id: string;
  title: string;
  subreddit: string;
  permalink: string;
  body_preview: string | null;
  score: number;
  comment_generated: boolean;
};

export type RunOpportunity = {
  reddit_post_id: string;
  subreddit: string;
  title: string;
  permalink: string;
  body_preview: string | null;
  relevance_score: number;
  generated_comment: string;
};

export type RunSummary = {
  run_id: string;
  status: "success" | "failed";
  stats: RunStats;
  threshold: number;
  scored_preview: ScoredPreview[];
  opportunities: RunOpportunity[];
  error?: string;
};

export type ProgressEvent =
  | { type: "phase"; phase: "fetch" | "score" | "generate" | "saving"; total?: number }
  | {
      type: "fetch";
      subreddit: string;
      index: number;
      total: number;
      kept: number;
    }
  | { type: "dedup"; fresh: number; total: number }
  | { type: "score"; done: number; total: number }
  | { type: "score_done"; above_threshold: number; threshold: number }
  | { type: "comment"; done: number; total: number };

export async function runForClient(
  clientId: string,
  onProgress?: (e: ProgressEvent) => void,
): Promise<RunSummary> {
  const emit = (e: ProgressEvent) => {
    try {
      onProgress?.(e);
    } catch {
      /* never let UI crash kill the pipeline */
    }
  };

  const db = createAdminClient();

  const { data: client, error: clientErr } = await db
    .from("clients")
    .select(
      "id, name, url, description, extra_keywords, active, brand_profile, score_threshold, excluded_subreddits, monthly_target, daily_cap",
    )
    .eq("id", clientId)
    .single<ClientRow>();

  if (clientErr || !client) {
    throw new Error(`Client not found: ${clientErr?.message ?? clientId}`);
  }

  const runDate = new Date().toISOString().slice(0, 10);

  const { data: run, error: runErr } = await db
    .from("runs")
    .upsert(
      { client_id: client.id, run_date: runDate, status: "pending" },
      { onConflict: "client_id,run_date" },
    )
    .select("id")
    .single();

  if (runErr || !run) {
    throw new Error(`Failed to create run: ${runErr?.message}`);
  }

  const stats: RunStats = {
    fetched: 0,
    new_after_dedup: 0,
    scored: 0,
    above_threshold: 0,
    opportunities: 0,
  };

  try {
    const profile = client.brand_profile;
    const excludedSet = new Set(
      (client.excluded_subreddits ?? []).map((s) => s.toLowerCase()),
    );
    const byId = new Map<string, RedditPost>();

    if (profile?.subreddits?.length) {
      // Whitelist mode: pull /new from each target sub and filter to a recent
      // window. Reddit's keyword search misses real venting/asking posts
      // because they don't use marketing language — pulling /new and letting
      // the scorer judge fit catches them.
      const subs = profile.subreddits
        .filter((s) => !excludedSet.has(s.toLowerCase()))
        .slice(0, MAX_SUBREDDITS_PER_RUN);

      const cutoffMs =
        Date.now() - POST_AGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

      emit({ type: "phase", phase: "fetch", total: subs.length });

      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i];
        let kept = 0;
        try {
          const posts = await fetchSubredditNew(sub, {
            limit: POSTS_PER_SUBREDDIT,
          });
          for (const p of posts) {
            const t = Date.parse(p.post_date);
            if (Number.isNaN(t) || t < cutoffMs) continue;
            if (!byId.has(p.reddit_post_id)) {
              byId.set(p.reddit_post_id, p);
              kept++;
            }
          }
          console.log(
            `[${client.name}] r/${sub} → ${posts.length} fetched, ${kept} in window`,
          );
        } catch (err) {
          console.error(`/new fetch failed for r/${sub}:`, err);
        }
        emit({
          type: "fetch",
          subreddit: sub,
          index: i + 1,
          total: subs.length,
          kept,
        });
      }

      // Belt-and-suspenders: drop anything whose subreddit isn't on the
      // allowed list.
      const allowed = new Set(subs.map((s) => s.toLowerCase()));
      for (const [id, post] of byId) {
        if (!allowed.has(post.subreddit.toLowerCase())) byId.delete(id);
      }
    } else {
      // No profile yet: broad global keyword search. User should run
      // research to get targeted results.
      const queries = [client.name, ...client.extra_keywords]
        .map((q) => q.trim())
        .filter(Boolean);

      emit({ type: "phase", phase: "fetch", total: queries.length });

      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        let kept = 0;
        try {
          const posts = await fetchRedditSearch(q, {
            limit: 15,
            window: "week",
          });
          for (const p of posts) {
            if (!byId.has(p.reddit_post_id)) {
              byId.set(p.reddit_post_id, p);
              kept++;
            }
          }
          console.log(
            `[${client.name}] (no profile) search "${q}" → ${posts.length} posts`,
          );
        } catch (err) {
          console.error(`Search failed for "${q}":`, err);
        }
        emit({
          type: "fetch",
          subreddit: `search:${q}`,
          index: i + 1,
          total: queries.length,
          kept,
        });
      }
      if (excludedSet.size) {
        for (const [id, post] of byId) {
          if (excludedSet.has(post.subreddit.toLowerCase())) byId.delete(id);
        }
      }
    }

    stats.fetched = byId.size;
    console.log(
      `[${client.name}] unique posts after whitelist + excludes: ${stats.fetched}`,
    );

    // 2. Filter out posts this client has already seen.
    const ids = [...byId.keys()];
    let fresh: RedditPost[] = [];
    if (ids.length) {
      const { data: seen } = await db
        .from("seen_posts")
        .select("reddit_post_id")
        .eq("client_id", client.id)
        .in("reddit_post_id", ids);
      const seenIds = new Set((seen ?? []).map((s) => s.reddit_post_id));
      fresh = ids
        .filter((id) => !seenIds.has(id))
        .map((id) => byId.get(id)!)
        .slice(0, MAX_POSTS_PER_CLIENT);
    }
    stats.new_after_dedup = fresh.length;
    emit({ type: "dedup", fresh: fresh.length, total: stats.fetched });

    // 3. Score each fresh post with Haiku.
    type Scored = { post: RedditPost; score: number; why: string };
    const scored: Scored[] = [];
    emit({ type: "phase", phase: "score", total: fresh.length });

    for (let i = 0; i < fresh.length; i += HAIKU_PARALLELISM) {
      const batch = fresh.slice(i, i + HAIKU_PARALLELISM);
      const results = await Promise.allSettled(
        batch.map((post) =>
          scorePost({
            client: {
              name: client.name,
              url: client.url,
              description: client.description,
              extra_keywords: client.extra_keywords,
              profile,
            },
            post: {
              title: post.title,
              subreddit: post.subreddit,
              summary: post.summary,
            },
          }),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") {
          scored.push({
            post: batch[j],
            score: r.value.score,
            why: r.value.why_it_fits,
          });
        } else {
          console.error(
            `Score failed for ${batch[j].reddit_post_id}:`,
            r.reason,
          );
        }
      }
      emit({
        type: "score",
        done: Math.min(i + batch.length, fresh.length),
        total: fresh.length,
      });
    }
    stats.scored = scored.length;

    // 4. Pick winners above threshold, sorted by score.
    const threshold = client.score_threshold ?? DEFAULT_SCORE_THRESHOLD;
    const winners = scored
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score);
    stats.above_threshold = winners.length;
    emit({
      type: "score_done",
      above_threshold: winners.length,
      threshold,
    });

    // 4b. Compute today's quota from monthly_target / days_left, capped by
    // daily_cap. The pipeline only generates comments up to this number, so
    // running the cron more often (hourly) doesn't burst-post — it just
    // gives the operator more chances to catch fresh leads.
    const quota = await computeRunQuota(db, client);
    const toWrite = winners.slice(
      0,
      Math.min(quota, MAX_COMMENTS_PER_RUN),
    );
    const commentGeneratedIds = new Set(
      toWrite.map((w) => w.post.reddit_post_id),
    );

    // 5. Generate comments with Sonnet.
    emit({ type: "phase", phase: "generate", total: toWrite.length });

    const opportunities: Array<{
      client_id: string;
      run_id: string;
      reddit_post_id: string;
      subreddit: string;
      title: string;
      permalink: string;
      post_date: string;
      relevance_score: number;
      why_it_fits: string;
      generated_comment: string;
    }> = [];

    for (let i = 0; i < toWrite.length; i += SONNET_PARALLELISM) {
      const batch = toWrite.slice(i, i + SONNET_PARALLELISM);
      const results = await Promise.allSettled(
        batch.map((w) =>
          generateComment({
            client: {
              name: client.name,
              url: client.url,
              description: client.description,
              profile,
            },
            post: {
              title: w.post.title,
              subreddit: w.post.subreddit,
              summary: w.post.summary,
            },
          }),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const w = batch[j];
        if (r.status === "fulfilled") {
          opportunities.push({
            client_id: client.id,
            run_id: run.id,
            reddit_post_id: w.post.reddit_post_id,
            subreddit: w.post.subreddit,
            title: w.post.title,
            permalink: w.post.permalink,
            post_date: w.post.post_date,
            relevance_score: w.score,
            why_it_fits: w.why,
            generated_comment: r.value,
          });
        } else {
          console.error(
            `Comment failed for ${w.post.reddit_post_id}:`,
            r.reason,
          );
        }
      }
      emit({
        type: "comment",
        done: Math.min(i + batch.length, toWrite.length),
        total: toWrite.length,
      });
    }
    stats.opportunities = opportunities.length;

    emit({ type: "phase", phase: "saving" });

    if (opportunities.length) {
      const { error } = await db.from("opportunities").insert(opportunities);
      if (error) throw error;
    }

    // 6. Mark every considered post as seen.
    if (fresh.length) {
      const rows = fresh.map((p) => ({
        client_id: client.id,
        reddit_post_id: p.reddit_post_id,
      }));
      await db.from("seen_posts").upsert(rows, {
        onConflict: "client_id,reddit_post_id",
        ignoreDuplicates: true,
      });
    }

    await db
      .from("runs")
      .update({
        status: "success",
        stats,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    const bodyById = new Map(fresh.map((p) => [p.reddit_post_id, p.summary]));

    const scored_preview: ScoredPreview[] = scored
      .sort((a, b) => b.score - a.score)
      .map((s) => ({
        reddit_post_id: s.post.reddit_post_id,
        title: s.post.title,
        subreddit: s.post.subreddit,
        permalink: s.post.permalink,
        body_preview: s.post.summary ? s.post.summary.slice(0, 280) : null,
        score: s.score,
        comment_generated: commentGeneratedIds.has(s.post.reddit_post_id),
      }));

    const opportunitiesView: RunOpportunity[] = opportunities.map((o) => ({
      reddit_post_id: o.reddit_post_id,
      subreddit: o.subreddit,
      title: o.title,
      permalink: o.permalink,
      body_preview: (() => {
        const b = bodyById.get(o.reddit_post_id);
        return b ? b.slice(0, 280) : null;
      })(),
      relevance_score: o.relevance_score,
      generated_comment: o.generated_comment,
    }));

    return {
      run_id: run.id,
      status: "success",
      stats,
      threshold,
      scored_preview,
      opportunities: opportunitiesView,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .from("runs")
      .update({
        status: "failed",
        stats,
        error: msg,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return {
      run_id: run.id,
      status: "failed",
      stats,
      threshold: client.score_threshold ?? DEFAULT_SCORE_THRESHOLD,
      scored_preview: [],
      opportunities: [],
      error: msg,
    };
  }
}

// Compute how many comments the run is allowed to generate, given the
// client's monthly target and daily cap and how many have already been
// delivered this month / today. Self-correcting: a slow day pulls future
// days harder; a strong day eases up future ones.
async function computeRunQuota(
  db: ReturnType<typeof createAdminClient>,
  client: ClientRow,
): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const daysLeft = Math.max(1, lastDay - now.getDate() + 1);

  const monthlyTarget = client.monthly_target ?? DEFAULT_MONTHLY_TARGET;
  const dailyCap = client.daily_cap ?? DEFAULT_DAILY_CAP;

  const [{ count: monthCount }, { count: todayCount }] = await Promise.all([
    db
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", startOfMonth),
    db
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", startOfDay),
  ]);

  const deliveredThisMonth = monthCount ?? 0;
  const deliveredToday = todayCount ?? 0;

  if (deliveredThisMonth >= monthlyTarget) return 0;

  const remainingThisMonth = monthlyTarget - deliveredThisMonth;
  const idealToday = Math.ceil(remainingThisMonth / daysLeft);
  const todayBudget = Math.min(idealToday, dailyCap);
  const remainingToday = Math.max(0, todayBudget - deliveredToday);

  return remainingToday;
}
