import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateSeedPost,
  generateSeedComments,
  type SeedClient,
  type SeedStyle,
} from "@/lib/ai/seed";
import type { BrandProfile } from "@/lib/ai/research";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const ALLOWED_STYLES = new Set<SeedStyle>(["organic", "brand_led"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const subredditRaw = (body as { subreddit?: unknown })?.subreddit;
  if (typeof subredditRaw !== "string" || !subredditRaw.trim()) {
    return new Response("subreddit required", { status: 400 });
  }
  const subreddit = subredditRaw.trim().replace(/^r\//i, "").slice(0, 60);

  const styleRaw = (body as { style?: unknown })?.style;
  const style: SeedStyle =
    typeof styleRaw === "string" && ALLOWED_STYLES.has(styleRaw as SeedStyle)
      ? (styleRaw as SeedStyle)
      : "organic";

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, url, description, brand_profile")
    .eq("id", id)
    .single();
  if (error || !client) return new Response("not found", { status: 404 });

  const seedClient: SeedClient = {
    name: client.name,
    url: client.url,
    description: client.description ?? null,
    profile: (client.brand_profile as BrandProfile | null) ?? null,
  };

  try {
    const post = await generateSeedPost({
      client: seedClient,
      subreddit,
      style,
    });
    const comments = await generateSeedComments({
      client: seedClient,
      subreddit,
      post,
      style,
    });

    const db = createAdminClient();
    const { data: inserted, error: insertErr } = await db
      .from("seed_posts")
      .insert({
        client_id: id,
        subreddit,
        style,
        post_title: post.title,
        post_body: post.body,
        comment_organic_1: comments.organic_1,
        comment_organic_2: comments.organic_2,
        comment_plug: comments.plug,
      })
      .select(
        "id, client_id, subreddit, style, post_title, post_body, comment_organic_1, comment_organic_2, comment_plug, status, created_at",
      )
      .single();
    if (insertErr) throw insertErr;

    return Response.json({ ok: true, seed_post: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
