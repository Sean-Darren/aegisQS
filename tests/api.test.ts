import { expect, test, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { server } from "@/mocks/server";
import { createApiClient, ApiError, createResources } from "@/lib/api";
const client = createApiClient("http://localhost/api/v1");
afterEach(() => vi.restoreAllMocks());
test("client sends cookie credentials and parses successful responses", async () => {
  const spy = vi.spyOn(globalThis, "fetch");
  const user = await createResources(client).me();
  expect(user.role).toBe("senior_qs");
  expect(spy.mock.calls[0][1]?.credentials).toBe("include");
});
test("HTTP errors preserve status/code and use a stable fallback for non-JSON errors", async () => {
  server.use(
    http.get("*/api/v1/error", () =>
      HttpResponse.json(
        { message: "Unavailable", code: "TEMPORARY" },
        { status: 503 },
      ),
    ),
  );
  await expect(client.get("/error", z.object({}))).rejects.toMatchObject({
    name: "ApiError",
    kind: "http",
    status: 503,
    code: "TEMPORARY",
    message: "Unavailable",
  });
  server.use(
    http.get("*/api/v1/error", () =>
      HttpResponse.text("gateway error", { status: 502 }),
    ),
  );
  await expect(client.get("/error", z.object({}))).rejects.toMatchObject({
    kind: "http",
    status: 502,
    message: "Request failed with status 502.",
  });
});
test("invalid JSON and contract mismatches normalize to validation errors", async () => {
  server.use(http.get("*/api/v1/invalid", () => HttpResponse.text("not json")));
  await expect(client.get("/invalid", z.string())).rejects.toMatchObject({
    kind: "validation",
  });
  server.use(
    http.get("*/api/v1/invalid", () => HttpResponse.json({ value: "wrong" })),
  );
  await expect(
    client.get("/invalid", z.object({ value: z.number() })),
  ).rejects.toMatchObject({ kind: "validation", code: "INVALID_RESPONSE" });
});
test("network and cancellation failures are distinct ApiErrors", async () => {
  server.use(http.get("*/api/v1/network", () => HttpResponse.error()));
  await expect(client.get("/network", z.unknown())).rejects.toBeInstanceOf(
    ApiError,
  );
  await expect(client.get("/network", z.unknown())).rejects.toMatchObject({
    kind: "network",
  });
  const controller = new AbortController();
  controller.abort();
  await expect(
    client.get("/me", z.unknown(), { signal: controller.signal }),
  ).rejects.toMatchObject({ kind: "aborted" });
});
