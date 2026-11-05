"use client";

import { z } from "zod";
import {
  bimJobCreatedSchema,
  bimJobSnapshotSchema,
  bimProgressEventSchema,
  type BimProgressEvent,
} from "@/schemas";

export const bimWorkerUrl = (
  process.env.NEXT_PUBLIC_BIM_WORKER_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function parseJson<S extends z.ZodType>(response: Response, schema: S) {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!response.ok) {
    const message =
      parsed.success &&
      typeof parsed.data === "object" &&
      parsed.data !== null &&
      "message" in parsed.data &&
      typeof (parsed.data as { message?: unknown }).message === "string"
        ? (parsed.data as { message: string }).message
        : `BIM worker request failed with status ${response.status}.`;
    throw new Error(message);
  }
  if (!parsed.success) {
    throw new Error("The BIM worker returned an unexpected response.");
  }
  return parsed.data;
}

export async function startBimAssessment(file: File, specs?: unknown[]) {
  const form = new FormData();
  form.set("file", file);
  if (specs?.length) form.set("specs", JSON.stringify(specs));
  const response = await fetch(`${bimWorkerUrl}/api/v1/bim/assessments`, {
    method: "POST",
    body: form,
  });
  return parseJson(response, bimJobCreatedSchema);
}

export async function getBimJob(jobId: string) {
  const response = await fetch(
    `${bimWorkerUrl}/api/v1/bim/assessments/${jobId}`,
    { cache: "no-store" },
  );
  return parseJson(response, bimJobSnapshotSchema);
}

export function connectBimProgress(
  jobId: string,
  onEvent: (event: BimProgressEvent) => void,
  onError?: (error: Error) => void,
) {
  const url = new URL(`/ws/bim/${jobId}`, bimWorkerUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(url);
  socket.addEventListener("message", (message) => {
    try {
      const parsed = bimProgressEventSchema.safeParse(
        JSON.parse(String(message.data)),
      );
      if (!parsed.success) throw new Error("Invalid BIM progress event");
      onEvent(parsed.data);
    } catch (error) {
      onError?.(
        error instanceof Error ? error : new Error("Invalid BIM progress event"),
      );
    }
  });
  socket.addEventListener("error", () =>
    onError?.(new Error("BIM progress connection failed")),
  );
  return () => socket.close();
}
