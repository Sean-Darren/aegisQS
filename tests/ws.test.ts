import { afterEach, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { applyProjectEvent } from "@/lib/ws/cache";
import { connectProjectSocket } from "@/lib/ws/client";
import { queryKeys, createApiClient, createResources } from "@/lib/api";
import { comparisons, workbookVersions } from "@/mocks/fixtures/data";
import { emit } from "@/mocks/ws/events";
import type { WsEvent } from "@/schemas";
afterEach(() => vi.useRealTimers());
test("validated WebSocket events reach the sole client and remain project-scoped", async () => {
  const events: WsEvent[] = [];
  const stop = connectProjectSocket("P-001", {
    baseUrl: "http://localhost",
    onEvent: (event) => events.push(event),
    reconnect: false,
  });
  try {
    await vi.waitFor(() =>
      expect(events.some((e) => e.type === "comparison.progress")).toBe(true),
    );
    emit("P-001", {
      type: "document.version_added",
      documentId: "D-A201",
      versionId: "D-A201-v3",
      conflict: false,
    });
    await vi.waitFor(() =>
      expect(events.some((e) => e.type === "document.version_added")).toBe(
        true,
      ),
    );
    const count = events.length;
    emit("OTHER", {
      type: "comparison.progress",
      comparisonId: "other",
      status: "detecting",
      progressPct: 50,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toHaveLength(count);
  } finally {
    stop();
  }
});
test("cache progress writes preserve complete contracts and completion invalidates related data", () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.comparison("CMP-A201"), comparisons[0]);
  client.setQueryData(queryKeys.drawings("P-001"), [
    { document: { id: "D-A201" }, latestComparison: comparisons[0] },
  ]);
  client.setQueryData(queryKeys.workbookVersion("WV-2"), {
    ...workbookVersions[1],
    status: "checking",
  });
  applyProjectEvent(client, "P-001", {
    type: "comparison.progress",
    comparisonId: "CMP-A201",
    status: "detecting",
    progressPct: 60,
  });
  expect(client.getQueryData(queryKeys.comparison("CMP-A201"))).toMatchObject({
    status: "detecting",
    progressPct: 60,
    documentId: "D-A201",
  });
  applyProjectEvent(client, "P-001", {
    type: "comparison.completed",
    comparisonId: "CMP-A201",
    status: "succeeded",
    changeCount: 4,
  });
  expect(client.getQueryData(queryKeys.comparison("CMP-A201"))).toMatchObject({
    status: "succeeded",
    progressPct: 100,
  });
  expect(client.getQueryState(queryKeys.drawings("P-001"))?.isInvalidated).toBe(
    true,
  );
  applyProjectEvent(client, "P-001", {
    type: "workbook.checked",
    workbookId: "WB-001",
    versionId: "WV-2",
    checkSummary: { errors: 3, warnings: 1, info: 0 },
  });
  expect(client.getQueryData(queryKeys.workbookVersion("WV-2"))).toMatchObject({
    status: "checked",
    checkSummary: { errors: 3, warnings: 1, info: 0 },
  });
  client.clear();
});
test("a comparison completes with no socket subscribers, and reconnect sees current state", async () => {
  const api = createResources(createApiClient("http://localhost/api/v1"));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const c = await api.runComparison("P-001", {
    documentId: "D-A201",
    baseVersionId: "D-A201-v2",
    targetVersionId: "D-A201-v3",
  });
  await vi.advanceTimersByTimeAsync(10000);
  vi.useRealTimers();
  const events: WsEvent[] = [];
  const stop = connectProjectSocket("P-001", {
    baseUrl: "http://localhost",
    onEvent: (e) => events.push(e),
    reconnect: false,
  });
  try {
    await vi.waitFor(() =>
      expect(events).toContainEqual({
        type: "comparison.progress",
        comparisonId: c.id,
        status: "succeeded",
        progressPct: 100,
      }),
    );
  } finally {
    stop();
  }
});

test("the socket client rejects unknown event shapes", async () => {
  const received = vi.fn(),
    errors = vi.fn();
  class InvalidSocket extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() =>
        this.dispatchEvent(
          new MessageEvent("message", { data: '{"type":"unknown"}' }),
        ),
      );
    }
    close() {}
  }
  vi.stubGlobal("WebSocket", InvalidSocket);
  const stop = connectProjectSocket("P-001", {
    baseUrl: "http://localhost",
    onEvent: received,
    onError: errors,
    reconnect: false,
  });
  try {
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());
    expect(received).not.toHaveBeenCalled();
  } finally {
    stop();
    vi.unstubAllGlobals();
  }
});
