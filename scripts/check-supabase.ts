import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { checkSupabaseConnection } from "../src/lib/supabase/connection.ts";

try {
  const result = await checkSupabaseConnection(getSupabaseConfig());
  console.log("Connected to Supabase PostgreSQL through the Data API.");
  console.log(
    result.projectsTable === "private"
      ? "The projects table is private, as intended. Sign in through the application to read project data."
      : result.projectsTable === "missing"
        ? "The public.projects table is not exposed in the Data API schema cache yet. Application database migrations are still needed."
        : "The projects table is queryable with this key (zero rows requested). This does not verify project-membership policies.",
  );
  console.log(
    "This read-only check does not verify application tables, sign-in or write permissions.",
  );
} catch (error) {
  // Only the sanitized errors produced by our own helpers reach this output.
  console.error(
    error instanceof Error
      ? error.message
      : "Supabase connection check failed.",
  );
  process.exitCode = 1;
}
