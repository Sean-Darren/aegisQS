import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Request-scoped client for Route Handlers and Server Actions, where cookies
 * can be written. Do not reuse across requests or import from client components.
 * All auth operations must stay server-side: the app uses httpOnly cookies.
 * Pass responseHeaders to the eventual HTTP response, including auth refresh
 * cache headers. This is infrastructure; application sign-in is not wired yet.
 */
export async function createSupabaseServerClient(responseHeaders: Headers) {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();
  responseHeaders.set("Cache-Control", "private, no-store");
  return createServerClient(url, publishableKey, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (updates, headers) => {
        for (const [name, value] of Object.entries(headers)) {
          responseHeaders.set(name, value);
        }
        for (const { name, value, options } of updates) {
          cookieStore.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
        }
      },
    },
  });
}
