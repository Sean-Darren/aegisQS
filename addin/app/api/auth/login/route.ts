export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = `${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`;
  if (request.headers.get("origin") !== origin)
    return new Response(null, { status: 403 });
  const base = process.env.SMART_QS_API_ORIGIN;
  if (!base)
    return Response.json(
      { message: "Configure SMART_QS_API_ORIGIN." },
      { status: 503 },
    );
  const form = await request.formData();
  const locale = form.get("locale") === "zh-HK" ? "zh-HK" : "en";
  const returnUrl = new URL(String(form.get("returnTo") ?? "/signin"), origin);
  if (returnUrl.origin !== origin || returnUrl.pathname !== "/signin")
    return new Response(null, { status: 400 });
  try {
    const url = new URL("/api/auth/login", base);
    const response = await fetch(url, {
      method: "POST",
      body: form,
      headers: { Origin: url.origin },
      redirect: "manual",
      cache: "no-store",
    });
    const location = response.headers.get("location");
    const ok =
      response.status === 303 && location && !location.includes("/login?error");
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      Location: ok
        ? returnUrl.href
        : `/login?error=1&locale=${locale}&returnTo=${encodeURIComponent(returnUrl.href)}`,
    });
    for (const cookie of response.headers.getSetCookie())
      headers.append(
        "Set-Cookie",
        cookie.replace(/;\s*SameSite=Lax/gi, "; SameSite=None") +
          (/;\s*Secure/i.test(cookie) ? "" : "; Secure"),
      );
    return new Response(null, { status: 303, headers });
  } catch {
    return Response.json(
      { message: "Smart QS is unavailable." },
      { status: 502 },
    );
  }
}
