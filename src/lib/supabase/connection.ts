import { z } from "zod";
import type { SupabaseConfig } from "./config";

const projectsProbeSchema = z.array(z.object({ id: z.string() })).max(0);
const missingTableSchema = z.object({ code: z.literal("PGRST205") });
const privateTableSchema = z.object({ code: z.literal("42501") });

/** Read-only Data API probe. Does not read rows, create tables or change data. */
export async function checkSupabaseConnection(
  config: SupabaseConfig,
  fetcher: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(
      new URL("/rest/v1/projects?select=id&limit=0", config.url),
      {
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new Error(
      "Cannot reach Supabase. Check the project URL, network/DNS access and whether the project is running.",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Supabase Data API returned an unreadable response.");
  }
  // Schema discovery requires a secret key on hosted Supabase. A missing-table
  // response from PostgREST still verifies the key and Data API connectivity.
  if (response.status === 404 && missingTableSchema.safeParse(body).success) {
    return { connected: true as const, projectsTable: "missing" as const };
  }
  if (
    [401, 403].includes(response.status) &&
    privateTableSchema.safeParse(body).success
  ) {
    return { connected: true as const, projectsTable: "private" as const };
  }
  if (!response.ok) {
    throw new Error(
      `Supabase Data API returned HTTP ${response.status}. Check that the publishable key belongs to this project and the Data API is enabled.`,
    );
  }
  const parsed = projectsProbeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Supabase Data API returned an unexpected response.");
  }
  return {
    connected: true as const,
    projectsTable: "accessible" as const,
  };
}
