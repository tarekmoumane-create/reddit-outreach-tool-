import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BrandProfile } from "@/lib/ai/research";
import { GenerateForm } from "./generate-form";

type Search = { client_id?: string };

type ClientOption = {
  id: string;
  name: string;
  subreddits: string[];
  hasProfile: boolean;
  active: boolean;
};

export default async function NewSeedPostPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();

  // Seed posts are a manual operator action, so they are NOT gated by the
  // `active` toggle (that flag only controls the daily auto-scraper). Show
  // every client; inactive ones just get a label in the dropdown.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, brand_profile, excluded_subreddits, active")
    .order("active", { ascending: false })
    .order("name");

  if (!clients || clients.length === 0) {
    redirect("/dashboard/clients/new");
  }

  const options: ClientOption[] = clients.map((c) => {
    const profile = (c.brand_profile as BrandProfile | null) ?? null;
    const excluded = new Set(
      (c.excluded_subreddits ?? []).map((s: string) => s.toLowerCase()),
    );
    const subreddits = (profile?.subreddits ?? []).filter(
      (s) => !excluded.has(s.toLowerCase()),
    );
    return {
      id: c.id,
      name: c.name,
      subreddits,
      hasProfile: !!profile,
      active: c.active !== false,
    };
  });

  const initialClientId =
    client_id && options.some((o) => o.id === client_id)
      ? client_id
      : options[0].id;

  return (
    <div className="flex flex-col gap-8">
      <div className="entry flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[34px] font-semibold leading-none tracking-[-0.02em] text-text">
            New seed post
          </h1>
          <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-text-muted">
            Pick a client, choose a subreddit from the suggestions, and
            we&apos;ll generate a planted post and three primer comments.
          </p>
        </div>
        <Link href="/dashboard/seed-posts" className="btn-secondary">
          ← Back
        </Link>
      </div>

      <GenerateForm clients={options} initialClientId={initialClientId} />
    </div>
  );
}
