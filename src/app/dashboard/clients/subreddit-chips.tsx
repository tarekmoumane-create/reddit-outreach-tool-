"use client";

import { useState } from "react";

export function SubredditChips({
  clientId,
  subreddits,
  initialExcluded,
}: {
  clientId: string;
  subreddits: string[];
  initialExcluded: string[];
}) {
  const [excluded, setExcluded] = useState<Set<string>>(
    () => new Set(initialExcluded),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(sub: string) {
    const next = new Set(excluded);
    if (next.has(sub)) next.delete(sub);
    else next.add(sub);

    const prev = excluded;
    setExcluded(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/excluded-subreddits`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ excluded: [...next] }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? res.statusText);
      }
    } catch (e) {
      setExcluded(prev);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const extras = [...excluded].filter((s) => !subreddits.includes(s));
  const all = [...subreddits, ...extras];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {all.map((sub) => {
          const isExcluded = excluded.has(sub);
          return (
            <button
              key={sub}
              type="button"
              onClick={() => toggle(sub)}
              disabled={busy}
              className={`pill transition ${
                isExcluded
                  ? "line-through opacity-50 hover:opacity-80"
                  : "hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              }`}
              title={isExcluded ? "Click to re-include" : "Click to exclude"}
            >
              r/{sub}
              <span className="text-[9px] opacity-60">
                {isExcluded ? "+" : "×"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-text-dim">
        <span>{excluded.size} excluded</span>
        {busy ? <span>· saving</span> : null}
        {error ? <span className="text-danger">· {error}</span> : null}
      </div>
    </div>
  );
}
