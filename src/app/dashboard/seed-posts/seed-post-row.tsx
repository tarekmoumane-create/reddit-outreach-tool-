"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type SeedPostStyle = "organic" | "brand_led" | "bridge";

export type SeedPostView = {
  id: string;
  subreddit: string;
  style: SeedPostStyle;
  post_title: string;
  post_body: string;
  comment_organic_1: string;
  comment_organic_2: string;
  comment_plug: string;
  status: "draft" | "posted" | "skipped";
  created_at: string;
  client_name: string;
};

const COMMENT_LABELS: Record<
  SeedPostStyle,
  { c1: string; c2: string; c3: string; c3Accent: boolean }
> = {
  organic: {
    c1: "Comment 1 (organic)",
    c2: "Comment 2 (organic)",
    c3: "Comment 3 (brand plug)",
    c3Accent: true,
  },
  brand_led: {
    c1: "Comment 1 (supportive)",
    c2: "Comment 2 (question)",
    c3: "Comment 3 (nuance)",
    c3Accent: false,
  },
  bridge: {
    c1: "Comment 1 (validates pain)",
    c2: "Comment 2 (introduces concept)",
    c3: "Comment 3 (names the project)",
    c3Accent: true,
  },
};

const STYLE_BADGES: Record<
  SeedPostStyle,
  { label: string; cls: string }
> = {
  organic: {
    label: "Organic",
    cls: "bg-surface-2 text-text-muted border-border",
  },
  brand_led: {
    label: "Brand-led",
    cls: "bg-accent-soft/60 text-accent border-accent-strong/40",
  },
  bridge: {
    label: "Bridge",
    cls: "bg-warning/10 text-warning border-warning/30",
  },
};

export function SeedPostRow({ seed: s }: { seed: SeedPostView }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<SeedPostView["status"]>(s.status);
  const [pending, startTransition] = useTransition();

  const labels = COMMENT_LABELS[s.style] ?? COMMENT_LABELS.organic;

  const date = new Date(s.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const statusCls =
    status === "posted"
      ? "bg-positive/10 text-positive border-positive/30"
      : status === "skipped"
        ? "bg-surface-2 text-text-dim border-border"
        : "bg-warning/10 text-warning border-warning/30";

  const styleBadge = STYLE_BADGES[s.style] ?? STYLE_BADGES.organic;

  function setRemote(next: SeedPostView["status"]) {
    setStatus(next);
    startTransition(async () => {
      await fetch(`/api/seed-posts/${s.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    });
  }

  return (
    <li className={`card ${expanded ? "" : "card-hover"}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        <span
          className={`inline-flex h-10 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] ${statusCls}`}
        >
          {status}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-medium leading-snug text-text line-clamp-2">
            {s.post_title}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11.5px] text-text-dim">
            <span>r/{s.subreddit}</span>
            <span className="h-3 w-px bg-border-strong" />
            <span className="text-text-muted">{s.client_name}</span>
            <span className="h-3 w-px bg-border-strong" />
            <span>{date}</span>
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${styleBadge.cls}`}
            >
              {styleBadge.label}
            </span>
          </div>
        </div>
        <span className="shrink-0 self-center text-[12px] text-text-muted">
          {expanded ? "Hide" : "Show bundle"}
        </span>
      </button>

      {expanded ? (
        <div className="entry flex flex-col gap-4 border-t border-border bg-bg-2/60 px-5 py-4">
          <CopyBlock label="Post title" value={s.post_title} />
          <CopyBlock label="Post body" value={s.post_body} multiline />
          <CopyBlock label={labels.c1} value={s.comment_organic_1} multiline />
          <CopyBlock label={labels.c2} value={s.comment_organic_2} multiline />
          <CopyBlock
            label={labels.c3}
            value={s.comment_plug}
            multiline
            accent={labels.c3Accent}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-[11.5px] text-text-muted">
              <span className="uppercase tracking-[0.1em] text-text-dim">
                Status
              </span>
              <StatusButton
                active={status === "draft"}
                disabled={pending}
                onClick={() => setRemote("draft")}
              >
                Draft
              </StatusButton>
              <StatusButton
                active={status === "posted"}
                disabled={pending}
                onClick={() => setRemote("posted")}
              >
                Posted
              </StatusButton>
              <StatusButton
                active={status === "skipped"}
                disabled={pending}
                onClick={() => setRemote("skipped")}
              >
                Skipped
              </StatusButton>
            </div>
            <a
              href={`https://reddit.com/r/${s.subreddit}/submit`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11.5px] text-text-muted hover:text-text"
            >
              Open r/{s.subreddit} submit ↗
            </a>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CopyBlock({
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
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
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

function StatusButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-50 ${
        active
          ? "border-accent-strong bg-accent-soft text-accent"
          : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
