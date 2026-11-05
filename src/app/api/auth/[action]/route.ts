import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertSameOrigin, errorResponse } from "@/lib/backend/api";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const locale = form.get("locale") === "zh-HK" ? "zh-HK" : "en";
    const { action } = await params;
    const auth = await createSupabaseServerClient(headers);
    if (action === "logout") {
      const { error } = await auth.auth.signOut({ scope: "local" });
      if (error) throw new Error("Sign out failed");
      headers.set("Location", `/${locale}/login`);
      return new Response(null, { status: 303, headers });
    }
    if (action !== "login") return new Response(null, { status: 404, headers });
    const parsed = z
      .object({ email: z.email(), password: z.string().min(1) })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      headers.set("Location", `/${locale}/login?error=1`);
      return new Response(null, { status: 303, headers });
    }
    const { error } = await auth.auth.signInWithPassword(parsed.data);
    headers.set(
      "Location",
      error ? `/${locale}/login?error=1` : `/${locale}/projects`,
    );
    return new Response(null, { status: 303, headers });
  } catch (error) {
    return errorResponse(error, headers);
  }
}
