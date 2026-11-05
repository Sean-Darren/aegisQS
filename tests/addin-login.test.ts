import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("../addin/src/signin", () => ({ default: () => null }));
import { POST } from "../addin/app/api/auth/login/route";
beforeEach(() => vi.stubEnv("SMART_QS_API_ORIGIN", "http://127.0.0.1:3300"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function submit(returnTo: string) {
  return POST(
    new Request("https://localhost:3200/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://localhost:3200", Host: "localhost:3200" },
      body: new URLSearchParams({
        returnTo,
        email: "test@example.com",
        password: "test-password",
        locale: "en",
      }),
    }),
  );
}
test("empty callback from an older login page safely falls back to signin", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 303,
      headers: { Location: "/en/projects" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await submit("");
  expect(result.status).toBe(303);
  expect(result.headers.get("Location")).toBe("https://localhost:3200/signin");
});
test("valid Office callback retains nonce and host information", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(null, {
        status: 303,
        headers: {
          Location: "/en/projects",
          "Set-Cookie": "sb-session=test; HttpOnly; SameSite=Lax; Path=/",
        },
      }),
    ),
  );
  const result = await submit("/signin?nonce=test-nonce&_host_Info=Excel");
  expect(result.status).toBe(303);
  expect(result.headers.get("Location")).toBe(
    "https://localhost:3200/signin?nonce=test-nonce&_host_Info=Excel",
  );
  expect(result.headers.get("Set-Cookie")).toContain("SameSite=None");
  expect(result.headers.get("Set-Cookie")).toContain("Secure");
});
test("foreign callbacks and unrelated local paths remain rejected", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await submit("https://attacker.example/signin")).status).toBe(400);
  expect((await submit("/other")).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

test("server-rendered sign-in link receives a stable callback without browser location", async () => {
  const { default: Page } = await import("../addin/app/signin/page");
  const element = await Page({
    searchParams: Promise.resolve({
      nonce: "dialog-nonce",
      locale: "en",
      _host_Info: "Excel",
    }),
  });
  expect(element.props.returnTo).toBe(
    "/signin?nonce=dialog-nonce&locale=en&_host_Info=Excel",
  );
});
