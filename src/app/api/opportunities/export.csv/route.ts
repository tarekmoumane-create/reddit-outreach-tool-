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

  let q = supabase
    .from("opportunities")
    .select(
      "client_id, reddit_post_id, subreddit, title, permalink, post_date, relevance_score, generated_comment, created_at, clients(name)",
    )
    .order("relevance_score", { ascending: false })
    .order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const headers = [
    "client",
    "score",
    "subreddit",
    "title",
    "permalink",
    "post_date",
    "generated_comment",
    "reddit_post_id",
    "created_at",
  ];

  const lines = [headers.join(",")];
  for (const o of data ?? []) {
    const joined = o.clients as
      | { name: string }
      | { name: string }[]
      | null;
    const clientName = Array.isArray(joined)
      ? (joined[0]?.name ?? "")
      : (joined?.name ?? "");
    lines.push(
      [
        csvEscape(clientName),
        csvEscape(o.relevance_score),
        csvEscape(o.subreddit),
        csvEscape(o.title),
        csvEscape(o.permalink),
        csvEscape(o.post_date),
        csvEscape(o.generated_comment),
        csvEscape(o.reddit_post_id),
        csvEscape(o.created_at),
      ].join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="opportunities-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
