import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Set DATABASE_URL in .env.local, or run supabase/migrations/202611050001_smart_qs.sql in the Supabase SQL editor.",
  );
  process.exit(1);
}
let config;
try {
  config = new URL(url);
  if (!["postgres:", "postgresql:"].includes(config.protocol)) throw Error();
} catch {
  console.error("DATABASE_URL must be a PostgreSQL connection URL.");
  process.exit(1);
}
// Password is passed in the subprocess environment, never as a command argument.
const env = {
  ...process.env,
  PGHOST: config.hostname,
  PGPORT: config.port || "5432",
  PGDATABASE: decodeURIComponent(config.pathname.slice(1)),
  PGUSER: decodeURIComponent(config.username),
  PGPASSWORD: decodeURIComponent(config.password),
  PGSSLMODE: "verify-full",
  PGSSLROOTCERT:
    config.searchParams.get("sslrootcert") ||
    process.env.PGSSLROOTCERT ||
    "system",
  PGCONNECT_TIMEOUT: "15",
};
if (["localhost", "127.0.0.1"].includes(config.hostname))
  env.PGSSLMODE = "disable";
const result = spawnSync("psql", ["--no-psqlrc", "--set", "ON_ERROR_STOP=1"], {
  env,
  input: readFileSync(
    new URL(
      "../supabase/migrations/202611050001_smart_qs.sql",
      import.meta.url,
    ),
  ),
  encoding: "utf8",
});
if (result.status !== 0) {
  console.error(
    "Migration failed. Check database access and whether this migration was already applied. Use the SQL editor if psql is unavailable.",
  );
  process.exit(1);
}
console.log("Smart QS migration applied. Run the seed script next.");
