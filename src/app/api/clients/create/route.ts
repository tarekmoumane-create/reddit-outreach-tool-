import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSiteContext } from "@/lib/research/fetch-site";
import { researchBrand } from "@/lib/ai/research";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

type CreatePayload = {
  name?: string;
  url?: string;
  description?: string | null;
  extra_keywords?: string[];
  active?: boolean;
  score_threshold?: number;
  monthly_target?: number;
  daily_cap?: number;
};

type StreamEvent =
  | { kind: "step"; step: "save" | "scrape" | "research" | "save-profile" }
  | {
      kind: "complete";
      clientId: string;
      profile: boolean;
      researchError?: string;
    }
  | { kind: "error"; message: string };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: Partial<CreatePayload>;
  try {
    body = (await req.json()) as Partial<CreatePayload>;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const rawUrl = String(body.url ?? "").trim();
  if (!name) return new Response("name required", { status: 400 });
  if (!rawUrl) return new Response("url required", { status: 400 });

  let url: string;
  try {
    url = new URL(rawUrl).toString();
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  const description = (body.description ?? "")?.toString().trim() || null;
  const extra_keywords = Array.isArray(body.extra_keywords)
    ? body.extra_keywords
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];
  const active = body.active !== false;
  const thresholdRaw = Number(body.score_threshold);
  const score_threshold = Number.isFinite(thresholdRaw)
    ? Math.max(0, Math.min(100, Math.round(thresholdRaw)))
    : 60;
  const monthlyRaw = Number(body.monthly_target);
  const monthly_target = Number.isFinite(monthlyRaw)
    ? Math.max(0, Math.min(1000, Math.round(monthlyRaw)))
    : 150;
  const dailyRaw = Number(body.daily_cap);
  const daily_cap = Number.isFinite(dailyRaw)
    ? Math.max(0, Math.min(100, Math.round(dailyRaw)))
    : 10;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (e: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };

      try {
        // Step 1: save the client row using the user's RLS-scoped session.
        send({ kind: "step", step: "save" });
        const { data: inserted, error: insertErr } = await supabase
          .from("clients")
          .insert({
            user_id: user.id,
            name,
            url,
            description,
            extra_keywords,
            active,
            score_threshold,
            monthly_target,
            daily_cap,
          })
          .select("id")
          .single();
        if (insertErr || !inserted) {
          send({
            kind: "error",
            message: insertErr?.message ?? "save failed",
          });
          controller.close();
          return;
        }
        const clientId: string = inserted.id;

        // Step 2 & 3: research the brand. If anything goes wrong we still
        // complete successfully (the client row is saved); the operator can
        // re-run research later from the settings page.
        let researchError: string | undefined;
        let profileSaved = false;

        try {
          send({ kind: "step", step: "scrape" });
          const siteText = await fetchSiteContext(url);

          send({ kind: "step", step: "research" });
          const profile = await researchBrand({ name, url, siteText });

          send({ kind: "step", step: "save-profile" });
          const db = createAdminClient();
          const { error: updateErr } = await db
            .from("clients")
            .update({
              brand_profile: profile,
              profile_updated_at: new Date().toISOString(),
            })
            .eq("id", clientId);
          if (updateErr) throw updateErr;
          profileSaved = true;
        } catch (e) {
          researchError = e instanceof Error ? e.message : String(e);
        }

        send({
          kind: "complete",
          clientId: clientId,
          profile: profileSaved,
          researchError,
        });
      } catch (e) {
        send({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
