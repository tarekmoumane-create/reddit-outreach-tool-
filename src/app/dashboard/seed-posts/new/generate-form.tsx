"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ClientOption = {
  id: string;
  name: string;
  subreddits: string[];
  hasProfile: boolean;};

type SeedPost = {
  id: string;
  subreddit: string;
  post_title: string;
  post_body: string;
  comment_organic_1: string;
  comment_organic_2: string;
  comment_plug: string;
};

type SeedPostResponse = {
  ok: boolean;
  seed_post?: SeedPost;
  error?: string;
};

type JobStatus = "pending" | "running" | "done" | "error";

type GenJob = {
  subreddit: string;
  status: JobStatus;
  error?: string;
  result?: SeedPost;
};

const MAX_PER_RUN = 5;
const PARALLELISM = 2;

function normalizeSub(raw: string): string {
  return raw.trim().replace(/^\/?r\//i, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 60);
}

export function GenerateForm({
  clients,
  initialClientId,
}: {
  clients: ClientOption[];
  initialClientId: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId);
  const current = useMemo(
    () => clients.find((c) => c.id === clientId) ?? clients[0],
    [clients, clientId],
  );
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(current.subreddits.slice(0, 1)),
  );
  const [customText, setCustomText] = useState("");
  const [jobs, setJobs] = useState<GenJob[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onClientChange(id: string) {
    setClientId(id);
    const next = clients.find((c) => c.id === id);
    setPicked(new Set(next?.subreddits.slice(0, 1) ?? []));
    setCustomText("");
    setJobs([]);
    setError(null);
  }

  function togglePick(sub: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      return next;
    });
  }

  const customSubs = useMemo(() => {
    return customText
      .split(/[\n,]/)
      .map(normalizeSub)
      .filter(Boolean);
  }, [customText]);

  const finalSubs = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...picked, ...customSubs]) {
      const key = s.toLowerCase();
      if (!seen.has(key) && s) {
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  }, [picked, customSubs]);

  const overLimit = finalSubs.length > MAX_PER_RUN;

  async function generateOne(subreddit: string): Promise<SeedPost> {
    const res = await fetch(`/api/clients/${clientId}/seed-posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subreddit }),
    });
    const text = await res.text();
    let parsed: SeedPostResponse;
    try {
      parsed = JSON.parse(text) as SeedPostResponse;
    } catch {
      throw new Error(text || res.statusText);
    }
    if (!res.ok || !parsed.ok || !parsed.seed_post) {
      throw new Error(parsed.error ?? res.statusText);
    }
    return parsed.seed_post;
  }

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (finalSubs.length === 0) {
      setError("pick at least one subreddit");
      return;
    }
    if (overLimit) {
      setError(`max ${MAX_PER_RUN} subreddits per run`);
      return;
    }

    const initial: GenJob[] = finalSubs.map((s) => ({
      subreddit: s,
      status: "pending",
    }));
    setJobs(initial);
    setPending(true);

    // Limited-parallelism worker pool: keeps a few Sonnet calls in flight at
    // once without firing all N requests at the same instant.
    let cursor = 0;
    const updateJob = (i: number, patch: Partial<GenJob>) => {
      setJobs((prev) => {
        const copy = prev.slice();
        copy[i] = { ...copy[i], ...patch };
        return copy;
      });
    };
    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= initial.length) return;
        updateJob(i, { status: "running" });
        try {
          const result = await generateOne(initial[i].subreddit);
          updateJob(i, { status: "done", result });
        } catch (err) {
          updateJob(i, {
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PARALLELISM, initial.length) }, worker),
    );

    setPending(false);
    router.refresh();
  }

  const doneCount = jobs.filter((j) => j.status === "done").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;

  return (
    <form onSubmit={go} className="flex flex-col gap-6">
      <div className="card flex flex-col gap-5 px-6 py-5">
        <Field label="Client">
          <select
            value={clientId}
            onChange={(e) => onClientChange(e.target.value)}
            className="input"
            disabled={pending}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.hasProfile ? "" : " · no research yet"}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={`Subreddits${
            finalSubs.length ? ` · ${finalSubs.length} selected` : ""
          }`}
          hint={
            current.subreddits.length === 0
              ? "No suggestions yet. Run brand research on this client, or just type subreddits below."
              : `Tick any you want a bundle for. Up to ${MAX_PER_RUN} per run — each one is its own post + 3 comments.`
          }
        >
          {current.subreddits.length > 0 ? (
            <div className="grid max-h-72 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-2 sm:grid-cols-2">
              {current.subreddits.map((s, i) => {
                const checked = picked.has(s);
                return (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] transition ${
                      checked
                        ? "bg-accent-soft/50 text-text"
                        : "text-text-2 hover:bg-bg-2/60"
                    } ${pending ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePick(s)}
                      disabled={pending}
                      className="h-3.5 w-3.5 accent-accent"
                    />
                    <span className="font-mono text-[11px] text-text-dim">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>r/{s}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </Field>

        <Field
          label="Custom subreddits"
          hint="One per line or comma-separated. The r/ prefix is optional."
        >
          <textarea
            placeholder="smallbusiness, entrepreneur&#10;sidehustle"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="input min-h-[72px] font-mono text-[12.5px]"
            disabled={pending}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="font-mono text-[11.5px] text-text-dim">
            {pending
              ? `Generating ${doneCount + errorCount}/${jobs.length}...`
              : overLimit
                ? `Too many — max ${MAX_PER_RUN}`
                : finalSubs.length === 0
                  ? "Pick or type at least one subreddit"
                  : `Will generate ${finalSubs.length} bundle${finalSubs.length === 1 ? "" : "s"}`}
          </span>
          <button
            type="submit"
            disabled={pending || finalSubs.length === 0 || overLimit}
            className="btn-primary"
          >
            {pending ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Generating
              </>
            ) : (
              <>
                <span className="text-[15px] leading-none">▶</span>
                Generate
              </>
            )}
          </button>
        </div>

        {error ? (
          <p className="font-mono text-[12px] text-danger">failed: {error}</p>
        ) : null}
      </div>

      {jobs.length > 0 ? (
        <div className="entry flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-text">
              Bundles
            </h2>
            <a
              href="/dashboard/seed-posts"
              className="text-[12px] text-text-muted hover:text-text"
            >
              View all →
            </a>
          </div>

          <ul className="flex flex-col gap-4">
            {jobs.map((j) => (
              <JobCard key={j.subreddit} job={j} />
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function JobCard({ job }: { job: GenJob }) {
  return (
    <li className="card flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusDot status={job.status} />
          <span className="font-mono text-[13px] text-text">
            r/{job.subreddit}
          </span>
        </div>
        <span
          className={`text-[11.5px] ${
            job.status === "error"
              ? "text-danger"
              : job.status === "done"
                ? "text-positive"
                : "text-text-muted"
          }`}
        >
          {job.status === "pending"
            ? "queued"
            : job.status === "running"
              ? "generating…"
              : job.status === "done"
                ? "done"
                : `failed: ${job.error ?? "unknown"}`}
        </span>
      </div>

      {job.result ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <Preview label="Post title" value={job.result.post_title} />
          <Preview label="Post body" value={job.result.post_body} multiline />
          <Preview
            label="Comment 1 (organic)"
            value={job.result.comment_organic_1}
            multiline
          />
          <Preview
            label="Comment 2 (organic)"
            value={job.result.comment_organic_2}
            multiline
          />
          <Preview
            label="Comment 3 (brand plug)"
            value={job.result.comment_plug}
            multiline
            accent
          />
        </div>
      ) : null}
    </li>
  );
}

function StatusDot({ status }: { status: JobStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-positive/15 text-[10px] text-positive">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger/15 text-[10px] text-danger">
        !
      </span>
    );
  }
  if (status === "running") {
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] uppercase tracking-[0.1em] text-text-dim">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[11.5px] text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function Preview({
  label,
  value,
  multiline,
  accent,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  accent?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        accent
          ? "border-accent-strong/50 bg-accent-soft/40"
          : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span
          className={`text-[10.5px] font-medium uppercase tracking-[0.1em] ${
            accent ? "text-accent" : "text-text-dim"
          }`}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className={`text-[11.5px] transition ${
            copied ? "text-positive" : "text-text-muted hover:text-text"
          }`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      {multiline ? (
        <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-text-2">
          {value}
        </pre>
      ) : (
        <p className="text-[14px] font-medium leading-snug text-text">
          {value}
        </p>
      )}
    </div>
  );
}
