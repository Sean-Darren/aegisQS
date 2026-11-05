import { beforeEach, expect, test, vi } from "vitest";
const auth = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async (headers: Headers) => {
    headers.set("Cache-Control", "private, no-store");
    return { auth: { signInWithPassword: auth.signIn, signOut: auth.signOut } };
  },
}));
import { POST } from "@/app/api/auth/[action]/route";
beforeEach(() => {
  vi.clearAllMocks();
  auth.signIn.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
function submit(
  action: string,
  origin = "http://localhost",
  values: Record<string, string> = {
    email: "test@example.com",
    password: "password",
    locale: "zh-HK",
  },
) {
  return POST(
    new Request(`http://localhost/api/auth/${action}`, {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams(values),
    }),
    { params: Promise.resolve({ action }) },
  );
}
test("real sign-in is server-side, locale-aware and never returns auth tokens", async () => {
  const response = await submit("login");
  expect(auth.signIn).toHaveBeenCalledWith({
    email: "test@example.com",
    password: "password",
  });
  expect(response.status).toBe(303);
  expect(response.headers.get("Location")).toBe("/zh-HK/projects");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(await response.text()).toBe("");
});
test("failed sign-in redirects without leaking upstream details", async () => {
  auth.signIn.mockResolvedValue({ error: new Error("private details") });
  const response = await submit("login");
  expect(response.headers.get("Location")).toBe("/zh-HK/login?error=1");
  expect(await response.text()).not.toContain("private details");
});
test("malformed input and external origins cannot invoke auth", async () => {
  expect((await submit("login", "https://elsewhere.test")).status).toBe(403);
  expect(auth.signIn).not.toHaveBeenCalled();
  await submit("login", "http://localhost", {
    email: "invalid",
    password: "",
    locale: "en",
  });
  expect(auth.signIn).not.toHaveBeenCalled();
});
test("sign-out affects the local session and returns to login", async () => {
  const response = await submit("logout");
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(response.headers.get("Location")).toBe("/zh-HK/login");
});

test("Next internal localhost normalization does not reject a matching browser Host", async () => {
  const response = await POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3300", Host: "127.0.0.1:3300" },
      body: new URLSearchParams({
        email: "test@example.com",
        password: "password",
        locale: "en",
      }),
    }),
    { params: Promise.resolve({ action: "login" }) },
  );
  expect(response.status).toBe(303);
  expect(auth.signIn).toHaveBeenCalledOnce();
});
