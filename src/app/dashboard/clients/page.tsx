import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RunNowButton } from "./run-now-button";

type RunStats = {
  fetched?: number;
  new_after_dedup?: number;
  scored?: number;
  above_threshold?: number;
  opportunities?: number;
};

type RunRow = {
  client_id: string;
  status: string | null;
  stats: RunStats | null;
  finished_at: string | null;
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select(
      "id, name, url, active, created_at, monthly_target",
    )
    .order("created_at", { ascending: false });

  const ids = (clients ?? []).map((c) => c.id);
  const { data: runs } = ids.length
    ? await supabase
        .from("runs")
        .select("client_id, status, stats, finished_at")
        .in("client_id", ids)
        .order("finished_at", { ascending: false, nullsFirst: false })
    : { data: [] as RunRow[] };

  const latestByClient = new Map<string, RunRow>();
  for (const r of (runs as RunRow[] | null) ?? []) {
    if (!latestByClient.has(r.client_id)) latestByClient.set(r.client_id, r);
  }

  // How many opportunities each client has delivered this calendar month.
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();
  const { data: monthOps } = ids.length
    ? await supabase
        .from("opportunities")
        .select("client_id")
        .in("client_id", ids)
        .gte("created_at", startOfMonth)
    : { data: [] as { client_id: string }[] };

  const monthDeliveredByClient = new Map<string, number>();
  for (const r of monthOps ?? []) {
    monthDeliveredByClient.set(
      r.client_id,
      (monthDeliveredByClient.get(r.client_id) ?? 0) + 1,
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="entry flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
            Clients
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-text-muted">
            Brands the daily run scrapes Reddit for. Hit Run to fetch fresh
            posts, score them, and generate replies.
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="btn-primary"
        >
          <span className="text-base leading-none">+</span>
          New client
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-danger">{error.message}</p>
      ) : !clients || clients.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="logo-mark" aria-hidden />
          <p className="mt-1 text-[15px] text-text">No clients yet</p>
          <p className="text-[13.5px] text-text-muted">
            Add your first one to start finding opportunities.
          </p>
          <Link href="/dashboard/clients/new" className="btn-primary mt-3">
            <span className="text-base leading-none">+</span>
            New client
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {clients.map((c, idx) => {
            const last = latestByClient.get(c.id);
            const opps = last?.stats?.opportunities ?? 0;
            const scored = last?.stats?.scored ?? 0;
            const failed = last?.status === "failed";
            const monthDelivered = monthDeliveredByClient.get(c.id) ?? 0;
            const monthTarget = c.monthly_target ?? 150;
            const monthPct = Math.min(
              100,
              Math.round((monthDelivered / Math.max(monthTarget, 1)) * 100),
            );
            const delay =
              idx === 0
                ? "delay-1"
                : idx === 1
                  ? "delay-2"
                  : idx === 2
                    ? "delay-3"
                    : "delay-4";
            return (
              <li
                key={c.id}
                className={`entry ${delay} card card-hover relative px-6 py-5`}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="truncate text-[18px] font-semibold tracking-tight text-text hover:text-accent"
                      >
                        {c.name}
                      </Link>
                      {c.active ? (
                        <span className="pill pill-active">
                          <span className="h-1.5 w-1.5 rounded-full bg-positive pulse-dot" />
                          Active
                        </span>
                      ) : (
                        <span className="pill">Paused</span>
                      )}
                    </div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block max-w-md truncate font-mono text-[12px] text-text-dim hover:text-accent"
                    >
                      {c.url}
                    </a>

                    <MonthlyProgress
                      delivered={monthDelivered}
                      target={monthTarget}
                      pct={monthPct}
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-text-muted">
                      <Stat label="Last run" value={relativeTime(last?.finished_at ?? null)} />
                      <Divider />
                      <Stat
                        label="Scored"
                        value={String(scored)}
                        mono
                      />
                      <Divider />
                      <Stat
                        label="Picked"
                        value={String(opps)}
                        mono
                        accent={opps > 0}
                      />
                      {failed ? (
                        <>
                          <Divider />
                          <span className="text-danger">last run failed</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/dashboard/opportunities?client_id=${c.id}`}
                      className="btn-secondary"
                    >
                      Opportunities
                    </Link>
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="btn-secondary"
                    >
                      Settings
                    </Link>
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-5">
                  <RunNowButton clientId={c.id} />
                </div>
              </li>
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
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-text-dim">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${
          accent ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-border-strong" />;
}

function MonthlyProgress({
  delivered,
  target,
  pct,
}: {
  delivered: number;
  target: number;
  pct: number;
}) {
  const onTrack = delivered >= target;
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="flex items-baseline gap-1.5 font-mono text-[12px]">
        <span
          className={onTrack ? "text-positive" : "text-text"}
        >
          {delivered}
        </span>
        <span className="text-text-dim">/</span>
        <span className="text-text-muted">{target}</span>
        <span className="ml-1 text-[10.5px] uppercase tracking-[0.08em] text-text-dim">
          this month
        </span>
      </div>
      <div className="h-[3px] flex-1 max-w-[180px] overflow-hidden rounded-full bg-border">
        <div
          className={`h-full transition-[width] duration-500 ${
            onTrack ? "bg-positive" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
