"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ClientOption = {
  id: string;
  name: string;
  subreddits: string[];
  hasProfile: boolean;
};

type SeedPostResponse = {
  ok: boolean;
  seed_post?: {
    id: string;
    subreddit: string;
    post_title: string;
    post_body: string;
    comment_organic_1: string;
    comment_organic_2: string;
    comment_plug: string;
  };
  error?: string;
};

const CUSTOM_VALUE = "__custom__";

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
  const [subChoice, setSubChoice] = useState<string>(
    current.subreddits[0] ?? CUSTOM_VALUE,
  );
  const [customSub, setCustomSub] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeedPostResponse["seed_post"] | null>(
    null,
  );

  function onClientChange(id: string) {
    setClientId(id);
    const next = clients.find((c) => c.id === id);
    setSubChoice(next?.subreddits[0] ?? CUSTOM_VALUE);
    setCustomSub("");
    setResult(null);
    setError(null);
  }

  const finalSub =
    subChoice === CUSTOM_VALUE
      ? customSub.trim().replace(/^r\//i, "")
      : subChoice;

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!finalSub) {
      setError("pick or type a subreddit");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/seed-posts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subreddit: finalSub }),
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
      setResult(parsed.seed_post);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

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
          label="Subreddit"
          hint={
            current.subreddits.length === 0
              ? "No suggestions yet. Run brand research on this client to populate the list, or type a subreddit below."
              : "Suggestions are ordered by research relevance, most likely first."
          }
        >
          <select
            value={subChoice}
            onChange={(e) => setSubChoice(e.target.value)}
            className="input"
            disabled={pending}
          >
            {current.subreddits.map((s, i) => (
              <option key={s} value={s}>
                {i + 1}. r/{s}
              </option>
            ))}
            <option value={CUSTOM_VALUE}>
              {current.subreddits.length === 0
                ? "Type a subreddit..."
                : "Other (type one)"}
            </option>
          </select>
          {subChoice === CUSTOM_VALUE ? (
            <input
              type="text"
              placeholder="e.g. r/smallbusiness"
              value={customSub}
              onChange={(e) => setCustomSub(e.target.value)}
              className="input mt-2"
              disabled={pending}
            />
          ) : null}
        </Field>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="font-mono text-[11.5px] text-text-dim">
            {pending
              ? "Generating post + 3 comments..."
              : "Sonnet generates the post first, then the comments"}
          </span>
          <button
            type="submit"
            disabled={pending || !finalSub}
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

      {result ? (
        <div className="entry flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-text">
              Bundle ready
            </h2>
            <a
              href="/dashboard/seed-posts"
              className="text-[12px] text-text-muted hover:text-text"
            >
              View all →
            </a>
          </div>
          <Preview label="Post title" value={result.post_title} />
          <Preview label="Post body" value={result.post_body} multiline />
          <Preview
            label="Comment 1 (organic)"
            value={result.comment_organic_1}
            multiline
          />
          <Preview
            label="Comment 2 (organic)"
            value={result.comment_organic_2}
            multiline
          />
          <Preview
            label="Comment 3 (brand plug)"
            value={result.comment_plug}
            multiline
            accent
          />
        </div>
      ) : null}
    </form>
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
