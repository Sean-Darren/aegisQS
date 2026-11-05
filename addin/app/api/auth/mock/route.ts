import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  if (process.env.ADDIN_API_MOCKING !== "enabled")
    return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new Response(null, { status: 403 });
  const response = NextResponse.json({ signedIn: true });
  response.cookies.set("smartqs-addin-demo", "signed-in", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  return response;
}
