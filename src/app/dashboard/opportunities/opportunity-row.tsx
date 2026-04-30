"use client";

import { useState } from "react";

export type OpportunityView = {
  id: string;
  subreddit: string;
  title: string;
  permalink: string;
  post_date: string;
  relevance_score: number;
  generated_comment: string;
  client_name: string;
};

export function OpportunityRow({
  opportunity: o,
}: {
  opportunity: OpportunityView;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const score = o.relevance_score;
  const isHot = score >= 80;

  const badgeCls = isHot
    ? "bg-accent-soft text-accent border-accent-strong shadow-[0_0_18px_-4px_rgba(200,74,42,0.45)]"
    : score >= 60
      ? "bg-warning/10 text-warning border-warning/30"
      : score >= 40
        ? "bg-surface-2 text-text-2 border-border-strong"
        : "bg-surface-2 text-text-dim border-border";

  async function copyComment(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(o.generated_comment);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const date = new Date(o.post_date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <li className={`card ${expanded ? "" : "card-hover"}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        <span
          className={`score inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-md border text-[15px] ${badgeCls}`}
        >
          {score}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-medium leading-snug text-text line-clamp-2">
            {o.title}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11.5px] text-text-dim">
            <span>r/{o.subreddit}</span>
            <span className="h-3 w-px bg-border-strong" />
            <span className="text-text-muted">{o.client_name}</span>
            <span className="h-3 w-px bg-border-strong" />
            <span>{date}</span>
          </div>
        </div>
        <span className="shrink-0 self-center text-[12px] text-text-muted">
          {expanded ? "Hide" : "Show reply"}
        </span>
      </button>

      {expanded ? (
        <div className="entry border-t border-border bg-bg-2/60 px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-text-dim">
              Reply
            </span>
            <div className="flex items-center gap-3">
              <a
                href={o.permalink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11.5px] text-text-muted hover:text-text"
              >
                Open on Reddit ↗
              </a>
              <button
                type="button"
                onClick={copyComment}
                className={`text-[11.5px] transition ${
                  copied ? "text-positive" : "text-text-muted hover:text-text"
                }`}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-text-2">
            {o.generated_comment}
          </pre>
        </div>
      ) : null}
    </li>
  );
}
