"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ScoredPreview = {
  reddit_post_id: string;
  title: string;
  subreddit: string;
  permalink: string;
  body_preview: string | null;
  score: number;
  comment_generated: boolean;
};

type RunOpportunity = {
  reddit_post_id: string;
  subreddit: string;
  title: string;
  permalink: string;
  body_preview: string | null;
  relevance_score: number;
  generated_comment: string;
};

type RunSummary = {
  status: "success" | "failed";
  threshold: number;
  stats: {
    fetched: number;
    new_after_dedup: number;
    scored: number;
    above_threshold: number;
    opportunities: number;
  };
  scored_preview: ScoredPreview[];
  opportunities: RunOpportunity[];
  error?: string;
};

type Phase = "idle" | "fetch" | "score" | "generate" | "saving" | "done" | "error";

type FetchState = {
  current: number;
  total: number;
  lastSub: string | null;
  kept: number;
};
type Counted = { done: number; total: number };

export function RunNowButton({
  clientId,
  compact = false,
}: {
  clientId: string;
  compact?: boolean;
}) {
  void compact;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [dedup, setDedup] = useState<{ fresh: number; total: number } | null>(
    null,
  );
  const [scoreState, setScoreState] = useState<Counted | null>(null);
  const [scoreDone, setScoreDone] = useState<{
    above_threshold: number;
    threshold: number;
  } | null>(null);
  const [genState, setGenState] = useState<Counted | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running =
    phase !== "idle" && phase !== "done" && phase !== "error";

  function reset() {
    setPhase("idle");
    setFetchState(null);
    setDedup(null);
    setScoreState(null);
    setScoreDone(null);
    setGenState(null);
    setSummary(null);
    setError(null);
  }

  async function go() {
    reset();
    setPhase("fetch");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`/api/clients/${clientId}/run`, {
        method: "POST",
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => res.statusText);
        setError(text || res.statusText);
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          handleEvent(JSON.parse(line));
        }
      }
      if (buf.trim()) handleEvent(JSON.parse(buf));
      router.refresh();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function handleEvent(ev: Record<string, unknown>) {
    if (ev.kind === "progress") {
      handleProgress(ev.event as Record<string, unknown>);
      return;
    }
    if (ev.kind === "summary") {
      const s = ev.summary as RunSummary;
      setSummary(s);
      setPhase(s.status === "failed" ? "error" : "done");
      if (s.status === "failed" && s.error) setError(s.error);
      return;
    }
    if (ev.kind === "error") {
      setError(String(ev.message ?? "unknown error"));
      setPhase("error");
    }
  }

  function handleProgress(ev: Record<string, unknown>) {
    const t = ev.type as string;
    if (t === "phase") {
      const ph = ev.phase as Phase;
      setPhase(ph);
      if (ph === "fetch")
        setFetchState({
          current: 0,
          total: Number(ev.total ?? 0),
          lastSub: null,
          kept: 0,
        });
      if (ph === "score")
        setScoreState({ done: 0, total: Number(ev.total ?? 0) });
      if (ph === "generate")
        setGenState({ done: 0, total: Number(ev.total ?? 0) });
      return;
    }
    if (t === "fetch") {
      setFetchState((prev) => ({
        current: Number(ev.index ?? 0),
        total: Number(ev.total ?? prev?.total ?? 0),
        lastSub: String(ev.subreddit ?? ""),
        kept: (prev?.kept ?? 0) + Number(ev.kept ?? 0),
      }));
      return;
    }
    if (t === "dedup") {
      setDedup({
        fresh: Number(ev.fresh ?? 0),
        total: Number(ev.total ?? 0),
      });
      return;
    }
    if (t === "score") {
      setScoreState({
        done: Number(ev.done ?? 0),
        total: Number(ev.total ?? 0),
      });
      return;
    }
    if (t === "score_done") {
      setScoreDone({
        above_threshold: Number(ev.above_threshold ?? 0),
        threshold: Number(ev.threshold ?? 0),
      });
      return;
    }
    if (t === "comment") {
      setGenState({
        done: Number(ev.done ?? 0),
        total: Number(ev.total ?? 0),
      });
      return;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {running ? <div className="live-bar" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={go}
          disabled={running}
          className="btn-primary"
        >
          {running ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Running
            </>
          ) : phase === "done" ? (
            <>
              <span className="text-[15px] leading-none">↻</span>
              Run again
            </>
          ) : (
            <>
              <span className="text-[15px] leading-none">▶</span>
              Run
            </>
          )}
        </button>

        {phase === "error" ? (
          <span className="font-mono text-[12px] text-danger">
            failed: {error}
          </span>
        ) : null}
      </div>

      {(running || phase === "done") && (
        <div className="entry flex flex-col gap-2.5">
          <PhaseRow
            label="Fetching subreddits"
            active={phase === "fetch"}
            done={phase !== "fetch"}
            detail={
              fetchState
                ? `${fetchState.current}/${fetchState.total}${
                    fetchState.lastSub ? `  ·  r/${fetchState.lastSub}` : ""
                  }${
                    fetchState.kept > 0
                      ? `  ·  ${fetchState.kept} in window`
                      : ""
                  }`
                : "preparing"
            }
            progress={
              fetchState
                ? fetchState.current / Math.max(fetchState.total, 1)
                : 0
            }
          />
          {dedup ? (
            <p className="px-1 font-mono text-[11.5px] text-text-dim">
              {dedup.fresh} new posts to score · {dedup.total - dedup.fresh}{" "}
              already seen
            </p>
          ) : null}
          <PhaseRow
            label="Scoring posts"
            active={phase === "score"}
            done={
              phase === "generate" || phase === "saving" || phase === "done"
            }
            detail={
              scoreState
                ? scoreState.total === 0
                  ? "no fresh posts"
                  : `${scoreState.done}/${scoreState.total}`
                : "waiting"
            }
            progress={
              scoreState
                ? scoreState.done / Math.max(scoreState.total, 1)
                : 0
            }
          />
          {scoreDone ? (
            <p className="px-1 font-mono text-[11.5px] text-text-dim">
              <span
                className={
                  scoreDone.above_threshold > 0
                    ? "text-accent"
                    : "text-text-muted"
                }
              >
                {scoreDone.above_threshold}
              </span>{" "}
              above threshold of {scoreDone.threshold}
            </p>
          ) : null}
          <PhaseRow
            label="Generating replies"
            active={phase === "generate"}
            done={phase === "saving" || phase === "done"}
            detail={
              genState
                ? genState.total === 0
                  ? "none to generate"
                  : `${genState.done}/${genState.total}`
                : "waiting"
            }
            progress={
              genState ? genState.done / Math.max(genState.total, 1) : 0
            }
          />
          {phase === "saving" ? (
            <p className="px-1 font-mono text-[11.5px] text-text-dim">
              Saving…
            </p>
          ) : null}
        </div>
      )}

      {summary && summary.status === "success" ? (
        <div className="entry flex flex-col gap-5">
          <StatStrip stats={summary.stats} threshold={summary.threshold} />

          {summary.opportunities.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[15px] font-medium text-text">
                  Generated replies
                </h3>
                <span className="font-mono text-[11.5px] text-text-dim">
                  {summary.opportunities.length} ready to copy
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {summary.opportunities.map((o) => (
                  <OpportunityCard key={o.reddit_post_id} o={o} />
                ))}
              </ul>
            </div>
          ) : null}

          {summary.scored_preview.length > 0 ? (
            <details className="card px-4 py-3">
              <summary className="cursor-pointer text-[13px] text-text-muted hover:text-text">
                All scored posts ({summary.scored_preview.length})
              </summary>
              <ul className="mt-3 flex flex-col">
                {summary.scored_preview.map((s, i) => (
                  <li
                    key={s.reddit_post_id}
                    className={`flex items-start gap-4 py-2.5 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <ScoreBadge
                      score={s.score}
                      threshold={summary.threshold}
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={s.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-[13.5px] text-text hover:text-accent"
                      >
                        {s.title}
                      </a>
                      <div className="font-mono text-[11px] text-text-dim">
                        r/{s.subreddit}
                      </div>
                      {s.body_preview ? (
                        <p className="mt-1 line-clamp-2 text-[12.5px] text-text-muted">
                          {s.body_preview}
                        </p>
                      ) : null}
                    </div>
                    {s.comment_generated ? (
                      <span className="pill pill-accent shrink-0">
                        Picked
                      </span>
                    ) : (
                      <span className="w-0 shrink-0" />
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatStrip({
  stats,
  threshold,
}: {
  stats: RunSummary["stats"];
  threshold: number;
}) {
  const items = [
    { label: "Fetched", value: stats.fetched },
    { label: "New", value: stats.new_after_dedup },
    { label: "Scored", value: stats.scored },
    {
      label: "Picked",
      value: stats.opportunities,
      highlight: stats.opportunities > 0,
    },
    { label: "Threshold", value: threshold, dim: true },
  ];
  return (
    <div className="card grid grid-cols-2 sm:grid-cols-5">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`flex flex-col gap-1 px-4 py-3.5 ${
            i > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : ""
          } ${
            i > 0 && i % 2 === 0 ? "border-l border-border" : ""
          }`}
        >
          <span className="text-[10.5px] uppercase tracking-[0.08em] text-text-dim">
            {it.label}
          </span>
          <span
            className={`stat-num text-[26px] ${
              it.highlight
                ? "text-accent"
                : it.dim
                  ? "text-text-muted"
                  : "text-text"
            }`}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PhaseRow({
  label,
  active,
  done,
  detail,
  progress,
}: {
  label: string;
  active: boolean;
  done: boolean;
  detail: string;
  progress: number;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <PhaseDot active={active} done={done} />
          <span
            className={`text-[13.5px] ${
              done ? "text-text-2" : active ? "text-text" : "text-text-muted"
            }`}
          >
            {label}
          </span>
        </div>
        <span className="font-mono text-[11.5px] text-text-muted">
          {detail}
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-border">
        {active && pct < 100 ? (
          <div
            className="h-full bar-progress transition-[width] duration-300"
            style={{ width: `${Math.max(pct, 6)}%` }}
          />
        ) : (
          <div
            className={`h-full transition-[width] duration-300 ${
              done
                ? "bg-positive/80"
                : active
                  ? "bg-accent"
                  : "bg-border-strong"
            }`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

function PhaseDot({ active, done }: { active: boolean; done: boolean }) {
  if (done) {
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-positive/15 text-[10px] text-positive">
        ✓
      </span>
    );
  }
  if (active) {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span className="inline-block h-2.5 w-2.5 rounded-full border border-border-strong bg-bg-2" />
  );
}

function ScoreBadge({
  score,
  threshold,
}: {
  score: number;
  threshold: number;
}) {
  let cls = "bg-surface-2 text-text-dim border-border";
  if (score >= 80) {
    cls =
      "bg-accent-soft text-accent border-accent-strong shadow-[0_0_18px_-4px_rgba(200,74,42,0.45)]";
  } else if (score >= threshold) {
    cls = "bg-warning/10 text-warning border-warning/30";
  } else if (score >= 40) {
    cls = "bg-surface-2 text-text-2 border-border-strong";
  }
  return (
    <span
      className={`score inline-flex h-9 w-11 shrink-0 items-center justify-center rounded-md border text-[14px] ${cls}`}
    >
      {score}
    </span>
  );
}

function OpportunityCard({ o }: { o: RunOpportunity }) {
  const [copied, setCopied] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const isHot = o.relevance_score >= 80;
  async function copy() {
    try {
      await navigator.clipboard.writeText(o.generated_comment);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <li className="card px-5 py-4">
      <div className="flex items-start gap-4">
        <ScoreBadge score={o.relevance_score} threshold={60} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[11.5px] text-text-dim">
              r/{o.subreddit}
            </span>
            {isHot ? (
              <span className="pill pill-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Hot lead
              </span>
            ) : null}
          </div>
          <a
            href={o.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-[15px] font-medium leading-snug text-text hover:text-accent"
          >
            {o.title}
          </a>
          {o.body_preview ? (
            <button
              type="button"
              onClick={() => setShowBody((v) => !v)}
              className="mt-1.5 font-mono text-[11px] text-text-dim hover:text-text-muted"
            >
              {showBody ? "− post body" : "+ post body"}
            </button>
          ) : null}
          {showBody && o.body_preview ? (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
              {o.body_preview}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-bg-2/60 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-text-dim">
            Reply
          </span>
          <button
            type="button"
            onClick={copy}
            className={`text-[11.5px] transition ${
              copied
                ? "text-positive"
                : "text-text-muted hover:text-text"
            }`}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-text-2">
          {o.generated_comment}
        </pre>
      </div>
    </li>
  );
}
