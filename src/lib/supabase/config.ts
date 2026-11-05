import { z } from "zod";

const configSchema = z.object({
  url: z.url(),
  publishableKey: z.string().trim().startsWith("sb_publishable_"),
});

export type SupabaseConfig = z.infer<typeof configSchema>;

/** Validate lazily so mock-mode builds do not require Supabase credentials. */
export function getSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig {
  const parsed = configSchema.safeParse({
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    // Never attach Zod input, which could contain credentials, to this error.
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and a valid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local. Use a publishable key, never a secret or service-role key.",
    );
  }
  const url = new URL(parsed.data.url);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "") ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "Use the HTTPS Supabase project URL, without a path or credentials.",
    );
  }
  return parsed.data;
}
