import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const clientId = req.nextUrl.searchParams.get("client_id");

  // RLS limits seed_posts to ones whose parent client belongs to the user.
  let q = supabase
    .from("seed_posts")
    .select(
      "client_id, subreddit, post_title, post_body, comment_organic_1, comment_organic_2, comment_plug, status, created_at, clients(name)",
    )
    .order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const headers = [
    "client",
    "subreddit",
    "status",
    "post_title",
    "post_body",
    "comment_organic_1",
    "comment_organic_2",
    "comment_plug",
    "created_at",
  ];

  const lines = [headers.join(",")];
  for (const s of data ?? []) {
    const joined = s.clients as
      | { name: string }
      | { name: string }[]
      | null;
    const clientName = Array.isArray(joined)
      ? (joined[0]?.name ?? "")
      : (joined?.name ?? "");
    lines.push(
      [
        csvEscape(clientName),
        csvEscape(s.subreddit),
        csvEscape(s.status),
        csvEscape(s.post_title),
        csvEscape(s.post_body),
        csvEscape(s.comment_organic_1),
        csvEscape(s.comment_organic_2),
        csvEscape(s.comment_plug),
        csvEscape(s.created_at),
      ].join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="seed-posts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
