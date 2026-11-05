import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  setCookie: vi.fn(),
  getCookies: vi.fn(() => [{ name: "session", value: "test-session" }]),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createClient }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.getCookies, set: mocks.setCookie }),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CookieMethodsServer } from "@supabase/ssr";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("server client keeps session cookies httpOnly and propagates auth cache headers", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
  vi.stubEnv("NODE_ENV", "production");
  const headers = new Headers();
  await createSupabaseServerClient(headers);
  const options = mocks.createClient.mock.calls[0][2] as {
    cookies: CookieMethodsServer;
    cookieOptions: Record<string, unknown>;
    global: { fetch: typeof fetch };
  };
  expect(options.cookieOptions).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  expect(options.cookies.getAll()).toEqual([
    { name: "session", value: "test-session" },
  ]);
  expect(headers.get("Cache-Control")).toBe("private, no-store");
  await options.cookies.setAll?.(
    [
      {
        name: "session",
        value: "refreshed-session",
        options: { httpOnly: false, secure: false },
      },
    ],
    { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" },
  );
  expect(mocks.setCookie).toHaveBeenCalledWith(
    "session",
    "refreshed-session",
    expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
  );
  expect(headers.get("Pragma")).toBe("no-cache");
  const fetcher = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetcher);
  await options.global.fetch("https://example.supabase.co/rest/v1/projects", {
    cache: "force-cache",
  });
  expect(fetcher).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ cache: "no-store" }),
  );
});
