import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "./filter-bar";
import { OpportunityRow } from "./opportunity-row";

type Search = { client_id?: string };

export default async function OpportunitiesPage({
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
    .from("opportunities")
    .select(
      "id, client_id, subreddit, title, permalink, post_date, relevance_score, generated_comment, created_at, clients(name)",
    )
    .order("relevance_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (client_id) query = query.eq("client_id", client_id);

  const { data: opps, error } = await query;

  const csvHref = `/api/opportunities/export.csv${
    client_id ? `?client_id=${encodeURIComponent(client_id)}` : ""
  }`;

  const total = opps?.length ?? 0;
  const hot = (opps ?? []).filter((o) => o.relevance_score >= 80).length;
  const warm = (opps ?? []).filter(
    (o) => o.relevance_score >= 60 && o.relevance_score < 80,
  ).length;
  const avg =
    total > 0
      ? Math.round(
          (opps ?? []).reduce((s, o) => s + o.relevance_score, 0) / total,
        )
      : 0;

  return (
    <div className="flex flex-col gap-10">
      <div className="entry flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
            Opportunities
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-text-muted">
            Top-scoring posts with generated replies. Click any row to see
            and copy the reply.
          </p>
        </div>
        <a href={csvHref} className="btn-secondary">
          <span className="text-[14px] leading-none">↓</span>
          Export CSV
        </a>
      </div>

      <div className="entry delay-1 card grid grid-cols-2 sm:grid-cols-4">
        <Stat label="Total" value={total} />
        <Stat label="Hot · 80+" value={hot} accent />
        <Stat label="Warm · 60–79" value={warm} muted />
        <Stat label="Average" value={avg} muted />
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
      ) : !opps || opps.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="logo-mark" aria-hidden />
          <p className="mt-1 text-[15px] text-text">No opportunities yet</p>
          <p className="text-[13.5px] text-text-muted">
            Run a client and replies will appear here.
          </p>
        </div>
      ) : (
        <ul className="entry delay-3 flex flex-col gap-2">
          {opps.map((o) => {
            const joined = o.clients as
              | { name: string }
              | { name: string }[]
              | null;
            const client_name = Array.isArray(joined)
              ? (joined[0]?.name ?? "—")
              : (joined?.name ?? "—");
            return (
              <OpportunityRow
                key={o.id}
                opportunity={{
                  id: o.id,
                  subreddit: o.subreddit,
                  title: o.title,
                  permalink: o.permalink,
                  post_date: o.post_date,
                  relevance_score: o.relevance_score,
                  generated_comment: o.generated_comment,
                  client_name,
                }}
              />
            );
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
