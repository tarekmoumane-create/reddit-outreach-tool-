import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const rawList = (body as { excluded?: unknown })?.excluded;
  if (!Array.isArray(rawList)) {
    return new Response("excluded must be string[]", { status: 400 });
  }
  const excluded = rawList
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 100);

  // RLS enforces ownership — update fails cleanly if the user doesn't own it.
  const { error } = await supabase
    .from("clients")
    .update({ excluded_subreddits: excluded })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, excluded });
}
