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
  try {
    const result = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const outgoing = new Headers();
    for (const key of ["content-type", "set-cookie", "x-next-cursor"]) {
      const value = result.headers.get(key);
      if (value) outgoing.set(key, value);
    }
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
