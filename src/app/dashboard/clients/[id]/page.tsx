import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BrandProfile } from "@/lib/ai/research";
import { ClientForm } from "../client-form";
import { DeleteClientForm } from "../delete-client-form";
import { ResearchButton } from "../research-button";
import { BrandProfileView } from "../brand-profile-view";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select(
      "id, name, url, description, extra_keywords, active, score_threshold, monthly_target, daily_cap, brand_profile, profile_updated_at, excluded_subreddits",
    )
    .eq("id", id)
    .single();

  if (error || !client) notFound();

  const profile = (client.brand_profile as BrandProfile | null) ?? null;

  return (
    <div className="flex flex-col gap-10">
      <div className="entry flex flex-wrap items-end justify-between gap-6">
        <div>
          <Link
            href="/dashboard/clients"
            className="text-[12.5px] text-text-muted hover:text-text"
          >
            ← Clients
          </Link>
          <h1 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
            {client.name}
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-muted">
            Settings, research, and tuning. Run scraping from the Clients page.
          </p>
        </div>
        <Link
          href={`/dashboard/seed-posts/new?client_id=${client.id}`}
          className="btn-primary"
        >
          <span className="text-base leading-none">+</span>
          Generate seed post
        </Link>
      </div>

      <Section
        kicker="01 · Research"
        title="Brand profile"
        hint="Scrapes the client's URL and uses Claude to infer industry, audience, pain points, subreddits, and search keywords. Powers scoring and reply quality."
      >
        <ResearchButton clientId={client.id} hasProfile={!!profile} />
        {profile ? (
          <div className="mt-6 border-t border-border pt-6">
            <BrandProfileView
              clientId={client.id}
              profile={profile}
              excludedSubreddits={client.excluded_subreddits ?? []}
              updatedAt={client.profile_updated_at ?? null}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
            <p className="text-[13px] text-warning">
              No brand profile yet — runs without research return very few
              relevant posts. Run research first.
            </p>
          </div>
        )}
      </Section>

      <Section kicker="02 · Fields" title="Editable fields">
        <ClientForm client={client} />
      </Section>

      <Section
        kicker="Danger"
        title="Delete client"
        tone="danger"
        hint="Removes the client, all its opportunities, and run history. Cannot be undone."
      >
        <DeleteClientForm id={client.id} name={client.name} />
      </Section>
    </div>
  );
}

function Section({
  kicker,
  title,
  hint,
  tone = "default",
  children,
}: {
  kicker: string;
  title: string;
  hint?: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  const kickerCls =
    tone === "danger" ? "text-danger" : "text-text-dim";
  return (
    <section className="card max-w-3xl px-6 py-6">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.1em]">
        <span className={kickerCls}>{kicker}</span>
      </div>
      <h2 className="text-[20px] font-semibold tracking-tight text-text">
        {title}
      </h2>
      {hint ? (
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
