import { NextRequest } from "next/server";
export const runtime = "nodejs";
let started = false;
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const mocking = process.env.ADDIN_API_MOCKING === "enabled";
  if (mocking && !request.cookies.has("smartqs-addin-demo"))
    return Response.json({ message: "Sign in first." }, { status: 401 });
  if (mocking && !started) {
    const { server } = await import("../../../../../src/mocks/server");
    server.listen({ onUnhandledRequest: "bypass" });
    started = true;
  }
  const base = mocking
    ? "http://smartqs.mock"
    : process.env.SMART_QS_API_ORIGIN;
  if (!base)
    return Response.json(
      { message: "Configure SMART_QS_API_ORIGIN." },
      { status: 503 },
    );
  const url = new URL(
    `/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    base,
  );
  const headers = new Headers();
  for (const key of ["content-type", "cookie"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (!mocking && request.method !== "GET") {
    if (
      request.headers.get("origin") !==
      (process.env.SMART_QS_ADDIN_PUBLIC_ORIGIN ??
        `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`)
    )
      return new Response(null, { status: 403 });
    headers.set("Origin", url.origin);
  }
  try {
    const result = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const outgoing = new Headers({ "Cache-Control": "private, no-store" });
    for (const key of ["content-type", "x-next-cursor"]) {
      const value = result.headers.get(key);
      if (value) outgoing.set(key, value);
    }
    for (const cookie of result.headers.getSetCookie())
      outgoing.append(
        "Set-Cookie",
        mocking
          ? cookie
          : cookie.replace(/;\s*SameSite=Lax/gi, "; SameSite=None") +
              (/;\s*Secure/i.test(cookie) ? "" : "; Secure"),
      );
    return new Response(await result.arrayBuffer(), {
      status: result.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      { message: "Smart QS is unavailable." },
      { status: 502 },
    );
  }
}
export { handle as GET, handle as POST };
