import { expect, test, vi } from "vitest";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { checkSupabaseConnection } from "@/lib/supabase/connection";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
};

test("missing or unsafe configuration is rejected without leaking credentials", () => {
  expect(getSupabaseConfig(env)).toEqual({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  expect(() => getSupabaseConfig({})).toThrow("Set NEXT_PUBLIC_SUPABASE_URL");
  const secret = "sb_secret_private_value";
  expect(() =>
    getSupabaseConfig({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret }),
  ).toThrow("never a secret");
  try {
    getSupabaseConfig({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
  } catch (error) {
    expect(String(error)).not.toContain(secret);
  }
  expect(() =>
    getSupabaseConfig({
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: "http://example.com",
    }),
  ).toThrow("HTTPS");
  expect(() =>
    getSupabaseConfig({
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: "https://user:password@example.com",
    }),
  ).toThrow("without a path or credentials");
  expect(() =>
    getSupabaseConfig({
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    }),
  ).not.toThrow();
});

test("connection check validates the Data API without querying rows or writing", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
  const result = await checkSupabaseConnection(getSupabaseConfig(env), fetcher);
  expect(result).toEqual({ connected: true, projectsTable: "accessible" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toBe(
    "https://example.supabase.co/rest/v1/projects?select=id&limit=0",
  );
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });
  expect(fetcher.mock.calls[0][1]?.method).toBeUndefined();
});

test("a missing projects table verifies connectivity without claiming schema readiness", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ code: "PGRST205" }, { status: 404 }));
  await expect(
    checkSupabaseConnection(getSupabaseConfig(env), fetcher),
  ).resolves.toEqual({ connected: true, projectsTable: "missing" });
});

test("network and upstream failures use sanitized messages", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("private upstream details"));
  await expect(
    checkSupabaseConnection(getSupabaseConfig(env), fetcher),
  ).rejects.toThrow("Cannot reach Supabase");
  fetcher.mockResolvedValue(
    Response.json({ message: "private upstream details" }, { status: 401 }),
  );
  await expect(
    checkSupabaseConnection(getSupabaseConfig(env), fetcher),
  ).rejects.toThrow("HTTP 401");
});

test("private database tables are a valid connection, not an invalid key", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ code: "42501" }, { status: 403 }));
  await expect(
    checkSupabaseConnection(getSupabaseConfig(env), fetcher),
  ).resolves.toEqual({ connected: true, projectsTable: "private" });
});

test("unreadable and unexpected successful responses do not count as connected", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("not JSON"));
  await expect(
    checkSupabaseConnection(getSupabaseConfig(env), fetcher),
  ).rejects.toThrow("unreadable");
  fetcher.mockResolvedValue(
    Response.json({ message: "not an API description" }),
  );
  await expect(
    checkSupabaseConnection(getSupabaseConfig(env), fetcher),
  ).rejects.toThrow("unexpected");
});
