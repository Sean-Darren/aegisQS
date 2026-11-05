import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
/** Only called after authentication. Never expose this client to the browser. */
export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfig();
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "SUPABASE_SECRET_KEY is required on the server. Apply the database migration before disabling mocks.",
    );
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
