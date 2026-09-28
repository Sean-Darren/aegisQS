import { expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createApiClient, createResources, queryKeys } from "@/lib/api";
import { applyProjectEvent } from "@/lib/ws/cache";
import { connectProjectSocket } from "@/lib/ws/client";
import { db } from "@/mocks/store";
import type { AnalysisJob, Flag, WsEvent } from "@/schemas";
const api = createResources(createApiClient("http://localhost/api/v1"));
function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}
test("real MSW socket delivers 48 auditor progress streams, three flags and completion in 20 seconds", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const cache = queryClient();
  const events: WsEvent[] = [];
  const errors: Error[] = [];
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  const stop = connectProjectSocket("P-001", {
    baseUrl: "http://localhost",
    reconnect: false,
    onOpen: open,
    onError: (error) => errors.push(error),
    onEvent: (event) => {
      events.push(event);
      applyProjectEvent(cache, "P-001", event);
    },
  });
  try {
    await opened;
    cache.setQueryData(queryKeys.flagList("P-001"), db.flags);
    const job = await api.runAnalysis("P-001");
    cache.setQueryData(queryKeys.job(job.id), job);
    await expect(api.runAnalysis("P-001")).rejects.toMatchObject({
      status: 409,
    });
    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() =>
      expect(events.some((event) => event.type === "flag.created")).toBe(true),
    );
    expect((await api.job(job.id)).status).toBe("running");
    expect(
      cache
        .getQueryData<AnalysisJob>(queryKeys.job(job.id))
        ?.progress.some((progress) => progress.pct > 0),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(() =>
      expect(events.some((event) => event.type === "job.completed")).toBe(true),
    );
    expect(
      events.filter((event) => event.type === "flag.created"),
    ).toHaveLength(3);
    const progress = events.filter((event) => event.type === "job.progress");
    expect(
      new Set(progress.map((event) => `${event.tendererId}:${event.auditor}`))
        .size,
    ).toBe(48);
    const completed = await api.job(job.id);
    expect(completed.status).toBe("succeeded");
    expect(
      completed.progress.every(
        (item) => item.status === "succeeded" && item.pct === 100,
      ),
    ).toBe(true);
    expect(
      Date.parse(completed.finishedAt!) - Date.parse(completed.startedAt),
    ).toBe(20000);
    expect(await api.flags("P-001")).toHaveLength(153);
    expect(
      cache.getQueryData<Flag[]>(queryKeys.flagList("P-001")),
    ).toHaveLength(153);
    expect(cache.getQueryState(queryKeys.job(job.id))?.isInvalidated).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    stop();
    cache.clear();
    vi.useRealTimers();
  }
});
test("jobs advance without subscribers and a late socket receives progress without restarting", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let stop: (() => void) | undefined;
  try {
    const job = await api.runAnalysis("P-001");
    await vi.advanceTimersByTimeAsync(10000);
    expect((await api.job(job.id)).progress[0].pct).toBe(50);
    const events: WsEvent[] = [];
    stop = connectProjectSocket("P-001", {
      baseUrl: "http://localhost",
      reconnect: false,
      onEvent: (event) => events.push(event),
    });
    await vi.waitFor(() =>
      expect(
        events.filter((event) => event.type === "job.progress"),
      ).toHaveLength(48),
    );
    stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect((await api.job(job.id)).status).toBe("succeeded");
    expect(await api.flags("P-001")).toHaveLength(153);
  } finally {
    stop?.();
    vi.useRealTimers();
  }
});
test("cache preserves filtered lists, deduplicates flags and isolates projects", () => {
  const client = queryClient();
  const flag = db.flags[0];
  const matching = queryKeys.flagList("P-001", { severity: flag.severity });
  const other = queryKeys.flagList("P-001", { severity: "low" });
  client.setQueryData(matching, []);
  client.setQueryData(other, []);
  client.setQueryData(queryKeys.flagList("P-OTHER"), []);
  applyProjectEvent(client, "P-001", { type: "flag.created", flag });
  applyProjectEvent(client, "P-001", { type: "flag.created", flag });
  expect(client.getQueryData(matching)).toEqual([flag]);
  expect(client.getQueryData(other)).toEqual([]);
  expect(client.getQueryData(queryKeys.flagList("P-OTHER"))).toEqual([]);
  applyProjectEvent(client, "P-001", {
    type: "flag.created",
    flag: { ...flag, id: "foreign", projectId: "P-OTHER" },
  });
  expect(client.getQueryData(queryKeys.flag("foreign"))).toBeUndefined();
  client.clear();
});
test("cache ignores unknown auditor statuses and delayed progress after completion", () => {
  const client = queryClient();
  const job = { ...db.jobs[0], status: "running" as const };
  client.setQueryData(queryKeys.job(job.id), job);
  const progress = {
    type: "job.progress" as const,
    jobId: job.id,
    ...job.progress[0],
    status: "unknown",
    pct: 25,
  };
  applyProjectEvent(client, "P-001", progress);
  expect(client.getQueryData(queryKeys.job(job.id))).toEqual(job);
  expect(client.getQueryState(queryKeys.job(job.id))?.isInvalidated).toBe(true);
  applyProjectEvent(client, "P-001", {
    type: "job.completed",
    jobId: job.id,
    status: "succeeded",
  });
  applyProjectEvent(client, "P-001", { ...progress, status: "running" });
  expect(client.getQueryData<AnalysisJob>(queryKeys.job(job.id))?.status).toBe(
    "succeeded",
  );
  client.clear();
});

test("owner viewers cannot subscribe to draft project analysis", async () => {
  const { setMockRole } = await import("@/mocks/store");
  setMockRole("owner_viewer");
  const socket = new WebSocket("ws://localhost/ws?projectId=P-001");
  const events: string[] = [];
  socket.addEventListener("message", (event) =>
    events.push(String(event.data)),
  );
  const code = await new Promise<number>((resolve) =>
    socket.addEventListener("close", (event) => resolve(event.code)),
  );
  expect(code).toBe(1008);
  expect(events).toEqual([]);
});
