import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Style = "organic" | "brand_led" | "bridge";

type SeedRow = {
  client_id: string;
  subreddit: string;
  style: Style;
  status: string;
  post_title: string;
  post_body: string;
  comment_organic_1: string;
  comment_organic_2: string;
  comment_plug: string;
  created_at: string;
  clients: { name: string } | { name: string }[] | null;
};

const SHEETS: Array<{
  style: Style;
  name: string;
  c1Header: string;
  c2Header: string;
  c3Header: string;
}> = [
  {
    style: "organic",
    name: "Organic",
    c1Header: "comment_1 (organic)",
    c2Header: "comment_2 (organic)",
    c3Header: "comment_3 (brand plug)",
  },
  {
    style: "brand_led",
    name: "Brand-led",
    c1Header: "comment_1 (supportive)",
    c2Header: "comment_2 (question)",
    c3Header: "comment_3 (nuance)",
  },
  {
    style: "bridge",
    name: "Bridge",
    c1Header: "comment_1 (validates pain)",
    c2Header: "comment_2 (introduces concept)",
    c3Header: "comment_3 (names project)",
  },
];

function clientName(joined: SeedRow["clients"]): string {
  if (Array.isArray(joined)) return joined[0]?.name ?? "";
  return joined?.name ?? "";
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
      "client_id, subreddit, style, status, post_title, post_body, comment_organic_1, comment_organic_2, comment_plug, created_at, clients(name)",
    )
    .order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as SeedRow[];

  // Bucket rows by style. Unknown / null style values fall through to
  // 'organic' for backwards compatibility with rows written before the
  // style column existed.
  const byStyle: Record<Style, SeedRow[]> = {
    organic: [],
    brand_led: [],
    bridge: [],
  };
  for (const r of rows) {
    const s: Style =
      r.style === "brand_led" || r.style === "bridge" ? r.style : "organic";
    byStyle[s].push(r);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "ThreadsLift";
  wb.created = new Date();

  for (const sheet of SHEETS) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "client", key: "client", width: 22 },
      { header: "subreddit", key: "subreddit", width: 22 },
      { header: "status", key: "status", width: 10 },
      { header: "post_title", key: "post_title", width: 60 },
      { header: "post_body", key: "post_body", width: 80 },
      { header: sheet.c1Header, key: "comment_1", width: 60 },
      { header: sheet.c2Header, key: "comment_2", width: 60 },
      { header: sheet.c3Header, key: "comment_3", width: 60 },
      { header: "created_at", key: "created_at", width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: "middle" };

    for (const r of byStyle[sheet.style]) {
      ws.addRow({
        client: clientName(r.clients),
        subreddit: r.subreddit,
        status: r.status,
        post_title: r.post_title,
        post_body: r.post_body,
        comment_1: r.comment_organic_1,
        comment_2: r.comment_organic_2,
        comment_3: r.comment_plug,
        created_at: r.created_at,
      });
    }

    // Wrap long text cells so they don't blow out the column widths.
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: "top", wrapText: true };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = `seed-posts-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buf, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
