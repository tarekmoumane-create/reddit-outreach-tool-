import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSiteContext } from "@/lib/research/fetch-site";
import { researchBrand } from "@/lib/ai/research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, url")
    .eq("id", id)
    .single();
  if (error || !client) return new Response("not found", { status: 404 });

  try {
    const siteText = await fetchSiteContext(client.url);
    const profile = await researchBrand({
      name: client.name,
      url: client.url,
      siteText,
    });

    const db = createAdminClient();
    const { error: updateErr } = await db
      .from("clients")
      .update({
        brand_profile: profile,
        profile_updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateErr) throw updateErr;

    return Response.json({ ok: true, profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
