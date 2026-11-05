import { z } from "zod";
import { authenticate, errorResponse } from "@/lib/backend/api";
import { wsEventSchema } from "@/schemas";
import { MockError } from "@/lib/domain/handlers/shared";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cookie-authenticated SSE adapter for Next hosting; WsEvent payloads are unchanged. */
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    const { user, db } = await authenticate(headers),
      projectId = new URL(request.url).searchParams.get("projectId");
    const { data: project } = await db
      .from("projects")
      .select("data")
      .eq("id", projectId ?? "")
      .eq("active", true)
      .maybeSingle();
    if (
      !project ||
      !Array.isArray(project.data.memberIds) ||
      !project.data.memberIds.includes(user.id)
    )
      throw new MockError(403, "Project access is required.");
    let cursor = Number(request.headers.get("last-event-id") ?? "0");
    if (!Number.isSafeInteger(cursor) || cursor < 0)
      throw new MockError(400, "Invalid event cursor.");
    if (!cursor) {
      const { data } = await db
        .from("project_events")
        .select("event_seq")
        .eq("project_id", projectId)
        .order("event_seq", { ascending: false })
        .limit(1);
      cursor = data?.[0]?.event_seq ?? 0;
    }
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const started = Date.now();
        try {
          controller.enqueue(encoder.encode("retry: 2000\n\n"));
          while (
            !closed &&
            !request.signal.aborted &&
            Date.now() - started < 50_000
          ) {
            const { data, error } = await db
              .from("project_events")
              .select("event_seq,data")
              .eq("project_id", projectId)
              .gt("event_seq", cursor)
              .order("event_seq")
              .limit(100);
            if (error) break;
            for (const row of z
              .array(
                z.object({
                  event_seq: z.number(),
                  data: z.object({ event: wsEventSchema }),
                }),
              )
              .parse(data)) {
              controller.enqueue(
                encoder.encode(
                  `id: ${row.event_seq}\ndata: ${JSON.stringify(row.data.event)}\n\n`,
                ),
              );
              cursor = row.event_seq;
            }
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
            await new Promise((r) => setTimeout(r, 1500));
          }
        } catch {
          /* Disconnect causes EventSource to reconnect with its last cursor. */
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        closed = true;
      },
    });
    headers.set("Content-Type", "text/event-stream");
    headers.set("X-Accel-Buffering", "no");
    return new Response(stream, { headers });
  } catch (error) {
    return errorResponse(error, headers);
  }
}
