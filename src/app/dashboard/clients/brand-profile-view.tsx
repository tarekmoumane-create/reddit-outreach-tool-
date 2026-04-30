import type { BrandProfile } from "@/lib/ai/research";
import { SubredditChips } from "./subreddit-chips";

export function BrandProfileView({
  clientId,
  profile,
  excludedSubreddits,
  updatedAt,
}: {
  clientId: string;
  profile: BrandProfile;
  excludedSubreddits: string[];
  updatedAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {updatedAt ? (
        <p className="font-mono text-[11px] text-text-dim">
          Updated{" "}
          {new Date(updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      ) : null}

      <Field label="Summary">
        <p className="text-[14px] leading-relaxed text-text-2">
          {profile.summary}
        </p>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Industry">
          <p className="text-[13.5px] text-text">{profile.industry}</p>
        </Field>
        <Field label="Audience">
          <p className="text-[13.5px] text-text">{profile.audience}</p>
        </Field>
        <Field label="Tone">
          <p className="text-[13.5px] text-text">{profile.tone}</p>
        </Field>
      </div>

      <Chips label="Value props" items={profile.value_props} />
      <Chips label="Pain points" items={profile.pain_points} />
      <Chips label="Competitors" items={profile.competitors} accent />

      <div>
        <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-dim">
          Subreddits ({profile.subreddits.length})
        </p>
        <p className="mt-1 mb-3 text-[12px] text-text-muted">
          Click a chip to exclude it. Excluded subs are skipped on every run.
        </p>
        <SubredditChips
          clientId={clientId}
          subreddits={profile.subreddits}
          initialExcluded={excludedSubreddits}
        />
      </div>

      <Chips
        label={`Keywords (${profile.keywords.length})`}
        items={profile.keywords}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-dim">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Chips({
  label,
  items,
  accent,
}: {
  label: string;
  items: string[];
  accent?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-dim">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className={`pill ${accent ? "pill-accent" : ""}`}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
