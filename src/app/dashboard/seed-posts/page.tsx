import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "../opportunities/filter-bar";
import { SeedPostRow, type SeedPostView } from "./seed-post-row";

type Search = { client_id?: string };

export default async function SeedPostsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  let query = supabase
    .from("seed_posts")
    .select(
      "id, client_id, subreddit, post_title, post_body, comment_organic_1, comment_organic_2, comment_plug, status, created_at, clients(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (client_id) query = query.eq("client_id", client_id);

  const { data: rows, error } = await query;

  const total = rows?.length ?? 0;
  const drafts = (rows ?? []).filter((r) => r.status === "draft").length;
  const posted = (rows ?? []).filter((r) => r.status === "posted").length;

  return (
    <div className="flex flex-col gap-10">
      <div className="entry flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
            Seed posts
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-text-muted">
            Plant a Reddit post for a client, then prime it with three
            candidate comments. Two read fully organic, the third quietly
            mentions the brand.
          </p>
        </div>
        <Link href="/dashboard/seed-posts/new" className="btn-primary">
          <span className="text-base leading-none">+</span>
          New seed post
        </Link>
      </div>

      <div className="entry delay-1 card grid grid-cols-3">
        <Stat label="Total" value={total} />
        <Stat label="Drafts" value={drafts} muted />
        <Stat label="Posted" value={posted} accent />
      </div>

      <div className="entry delay-2 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <span className="text-[11.5px] uppercase tracking-[0.1em] text-text-dim">
          Filter by client
        </span>
        <FilterBar
          clients={clients ?? []}
          currentClientId={client_id ?? ""}
        />
      </div>

      {error ? (
        <p className="text-sm text-danger">{error.message}</p>
      ) : !rows || rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="logo-mark" aria-hidden />
          <p className="mt-1 text-[15px] text-text">No seed posts yet</p>
          <p className="text-[13.5px] text-text-muted">
            Generate one to get a planted post and three primer comments.
          </p>
          <Link href="/dashboard/seed-posts/new" className="btn-primary mt-3">
            <span className="text-base leading-none">+</span>
            New seed post
          </Link>
        </div>
      ) : (
        <ul className="entry delay-3 flex flex-col gap-2">
          {rows.map((r) => {
            const joined = r.clients as
              | { name: string }
              | { name: string }[]
              | null;
            const client_name = Array.isArray(joined)
              ? (joined[0]?.name ?? "—")
              : (joined?.name ?? "—");
            const view: SeedPostView = {
              id: r.id,
              subreddit: r.subreddit,
              post_title: r.post_title,
              post_body: r.post_body,
              comment_organic_1: r.comment_organic_1,
              comment_organic_2: r.comment_organic_2,
              comment_plug: r.comment_plug,
              status: r.status as SeedPostView["status"],
              created_at: r.created_at,
              client_name,
            };
            return <SeedPostRow key={r.id} seed={view} />;
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4 not-first:border-l border-border">
      <span className="text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
        {label}
      </span>
      <span
        className={`stat-num text-[36px] ${
          accent ? "text-accent" : muted ? "text-text-muted" : "text-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

