import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../addin/app/api/v1/[...path]/route";

beforeEach(() => {
  vi.stubEnv("ADDIN_API_MOCKING", "disabled");
  vi.stubEnv("SMART_QS_API_ORIGIN", "https://app.example.com");
  vi.stubEnv("SMART_QS_ADDIN_PUBLIC_ORIGIN", "https://excel.example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (origin: string) =>
  new NextRequest("http://localhost:3200/api/v1/workbooks/WB-001/versions", {
    method: "POST",
    headers: {
      Origin: origin,
      Host: "excel.example.com",
      Cookie: "session=test",
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array([1, 2, 3]),
  });
const params = () => ({
  params: Promise.resolve({ path: ["workbooks", "WB-001", "versions"] }),
});

test("HTTPS proxy accepts only its configured public origin and forwards the upstream origin and session", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  const result = await POST(request("https://excel.example.com"), params());
  expect(result.status).toBe(201);
  const [url, init] = fetcher.mock.calls[0];
  expect(String(url)).toBe(
    "https://app.example.com/api/v1/workbooks/WB-001/versions",
  );
  expect(init.headers.get("Origin")).toBe("https://app.example.com");
  expect(init.headers.get("Cookie")).toBe("session=test");
});

test("a foreign mutation is rejected before contacting the upstream API", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await POST(request("https://attacker.example"), params())).status,
  ).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
