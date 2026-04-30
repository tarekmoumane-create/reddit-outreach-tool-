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
};

export default async function NewSeedPostPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, brand_profile, excluded_subreddits")
    .eq("active", true)
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
