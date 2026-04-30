import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runForClient,
  type ProgressEvent,
  type RunSummary,
} from "@/lib/pipeline/run-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StreamEvent =
  | { kind: "progress"; event: ProgressEvent }
  | { kind: "summary"; summary: RunSummary }
  | { kind: "error"; message: string };

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

  // RLS enforces ownership — this select returns null if the caller doesn't
  // own the client.
  const { data: owned, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .single();
  if (error || !owned) return new Response("not found", { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        const summary = await runForClient(id, (e) => {
          send({ kind: "progress", event: e });
        });
        send({ kind: "summary", summary });
      } catch (err) {
        send({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
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
