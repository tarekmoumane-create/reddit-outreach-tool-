import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return new Response("unauthorized", { status: 401 });
}

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const db = createAdminClient();
  const { data: clients, error } = await db
    .from("clients")
    .select("id")
    .eq("active", true);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL!;
  const secret = process.env.CRON_SECRET!;

  for (const c of clients ?? []) {
    fetch(`${base}/api/cron/client/${c.id}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    }).catch((err) =>
      console.error(`Dispatcher fan-out failed for ${c.id}:`, err),
    );
  }

  return Response.json({ dispatched: clients?.length ?? 0 });
}
