"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveClientAction, type ClientActionState } from "./actions";

type ClientRow = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  extra_keywords: string[];
  active: boolean;
  score_threshold?: number | null;
  monthly_target?: number | null;
  daily_cap?: number | null;
};

const initialState: ClientActionState = { error: null };

export function ClientForm({ client }: { client?: ClientRow }) {
  if (client) return <EditForm client={client} />;
  return <CreateForm />;
}

/* ----------------------- Edit (server action) ----------------------- */

function EditForm({ client }: { client: ClientRow }) {
  const [state, formAction, pending] = useActionState(
    saveClientAction,
    initialState,
  );
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="id" value={client.id} />
      <Fields client={client} disabled={pending} />
      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-4 pt-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving" : "Save changes"}
        </button>
        <Link
          href="/dashboard/clients"
          className="text-[13px] text-text-muted hover:text-text"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/* ----------------------- Create (streaming) ----------------------- */

type Step = "save" | "scrape" | "research" | "save-profile";

const STEP_ORDER: Step[] = ["save", "scrape", "research", "save-profile"];
const STEP_LABEL: Record<Step, string> = {
  save: "Saving client",
  scrape: "Reading website",
  research: "Building brand profile",
  "save-profile": "Storing profile",
};

function CreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [completed, setCompleted] = useState<Set<Step>>(new Set());
  const [done, setDone] = useState<{
    clientId: string;
    profile: boolean;
    researchError?: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCompleted(new Set());
    setCurrentStep(null);
    setDone(null);
    setPending(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      url: String(fd.get("url") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      extra_keywords: String(fd.get("extra_keywords") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      active: fd.get("active") === "on",
      score_threshold: Number(fd.get("score_threshold") ?? 60),
      monthly_target: Number(fd.get("monthly_target") ?? 150),
      daily_cap: Number(fd.get("daily_cap") ?? 10),
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => res.statusText);
        setError(text || "Request failed");
        setPending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handleEvent(JSON.parse(line));
        }
      }
      if (buf.trim()) handleEvent(JSON.parse(buf));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }

  function handleEvent(ev: Record<string, unknown>) {
    if (ev.kind === "step") {
      const step = ev.step as Step;
      const idx = STEP_ORDER.indexOf(step);
      setCompleted((prev) => {
        const next = new Set(prev);
        for (let i = 0; i < idx; i++) next.add(STEP_ORDER[i]);
        return next;
      });
      setCurrentStep(step);
      return;
    }
    if (ev.kind === "complete") {
      setCompleted(new Set(STEP_ORDER));
      setCurrentStep(null);
      const payload = {
        clientId: String(ev.clientId),
        profile: Boolean(ev.profile),
        researchError:
          typeof ev.researchError === "string" ? ev.researchError : undefined,
      };
      setDone(payload);
      // Give the user a moment to see the success state, then take them to
      // the settings page so they can review the brand profile.
      setTimeout(() => {
        router.push(`/dashboard/clients/${payload.clientId}`);
        router.refresh();
      }, 900);
      return;
    }
    if (ev.kind === "error") {
      setError(String(ev.message ?? "Unknown error"));
      setPending(false);
    }
  }

  const showProgress = pending || !!done;

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
      <fieldset disabled={showProgress} className="contents">
        <Fields disabled={showProgress} />
      </fieldset>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {showProgress ? (
        <ProgressPanel
          currentStep={currentStep}
          completed={completed}
          done={done}
        />
      ) : (
        <div className="flex items-center gap-4 pt-2">
          <button type="submit" className="btn-primary">
            <span className="text-[14px] leading-none">▶</span>
            Create &amp; research
          </button>
          <Link
            href="/dashboard/clients"
            className="text-[13px] text-text-muted hover:text-text"
          >
            Cancel
          </Link>
        </div>
      )}

      {!showProgress ? (
        <p className="text-[12px] text-text-dim">
          Adding the client kicks off automatic brand research — scraping the
          site and building a profile so the pipeline can find good posts on
          day one. Takes about 20–30 seconds.
        </p>
      ) : null}
    </form>
  );
}

function ProgressPanel({
  currentStep,
  completed,
  done,
}: {
  currentStep: Step | null;
  completed: Set<Step>;
  done: { clientId: string; profile: boolean; researchError?: string } | null;
}) {
  return (
    <div className="card mt-1 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-text-dim">
          Setting up
        </span>
        <span className="font-mono text-[11.5px] text-text-dim">
          {done ? "complete" : "live"}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {STEP_ORDER.map((s) => {
          const isDone = completed.has(s) || (done && done.profile);
          const isActive = currentStep === s;
          return (
            <li key={s} className="flex items-center gap-2.5">
              <StepDot active={!!isActive} done={!!isDone} />
              <span
                className={`text-[13.5px] ${
                  isDone
                    ? "text-text"
                    : isActive
                      ? "text-text"
                      : "text-text-muted"
                }`}
              >
                {STEP_LABEL[s]}
              </span>
              {isActive ? (
                <span className="ml-auto font-mono text-[11px] text-text-dim">
                  …
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {done ? (
        <div className="mt-4 border-t border-border pt-3">
          {done.profile ? (
            <p className="text-[13px] text-positive">
              ✓ Client created and profile built. Opening settings…
            </p>
          ) : (
            <p className="text-[13px] text-warning">
              Client saved, but research couldn&apos;t complete:{" "}
              <span className="font-mono text-[12px]">
                {done.researchError ?? "unknown error"}
              </span>
              . You can re-run it from the settings page.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
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

/* ----------------------- Shared fields ----------------------- */

function Fields({
  client,
  disabled,
}: {
  client?: ClientRow;
  disabled?: boolean;
}) {
  return (
    <>
      <Field label="Name" required>
        <input
          type="text"
          name="name"
          required
          defaultValue={client?.name ?? ""}
          placeholder="Acme Widgets"
          disabled={disabled}
          className="input"
        />
      </Field>

      <Field label="URL" required hint="Homepage or product page.">
        <input
          type="url"
          name="url"
          required
          defaultValue={client?.url ?? ""}
          placeholder="https://acme.example.com"
          disabled={disabled}
          className="input font-mono text-[13px]"
        />
      </Field>

      <Field
        label="Description"
        hint="Optional — used as a fallback if research fails."
      >
        <textarea
          name="description"
          rows={3}
          defaultValue={client?.description ?? ""}
          placeholder="Short pitch describing the product, audience, tone."
          disabled={disabled}
          className="input"
        />
      </Field>

      <Field
        label="Extra keywords"
        hint="Comma-separated. Broadens search and scoring signal."
      >
        <input
          type="text"
          name="extra_keywords"
          defaultValue={(client?.extra_keywords ?? []).join(", ")}
          placeholder="widget, gadget, gizmo"
          disabled={disabled}
          className="input font-mono text-[13px]"
        />
      </Field>

      <Field
        label="Score threshold"
        hint="0–100. Posts at or above this become opportunities."
      >
        <input
          type="number"
          name="score_threshold"
          min={0}
          max={100}
          defaultValue={client?.score_threshold ?? 60}
          disabled={disabled}
          className="input max-w-[120px] font-mono"
        />
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field
          label="Monthly target"
          hint="Comments to deliver this calendar month. Self-paced across remaining days."
        >
          <input
            type="number"
            name="monthly_target"
            min={0}
            max={1000}
            defaultValue={client?.monthly_target ?? 150}
            disabled={disabled}
            className="input font-mono"
          />
        </Field>
        <Field
          label="Daily cap"
          hint="Hard ceiling per day. Prevents burst-posting on Reddit."
        >
          <input
            type="number"
            name="daily_cap"
            min={0}
            max={100}
            defaultValue={client?.daily_cap ?? 10}
            disabled={disabled}
            className="input font-mono"
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 self-start text-[13.5px] text-text">
        <input
          type="checkbox"
          name="active"
          defaultChecked={client?.active ?? true}
          disabled={disabled}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Include in daily runs
      </label>
    </>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-dim">
        {label}
        {required ? <span className="ml-1 text-accent">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-[12px] text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
