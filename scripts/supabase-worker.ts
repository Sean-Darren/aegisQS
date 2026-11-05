import { createSupabaseAdminClient } from "../src/lib/supabase/admin.ts";
import { loadSnapshot, commitContext } from "../src/lib/backend/repository.ts";
import { decodeState } from "../src/lib/backend/records.ts";
import { createPersistentContext } from "../src/lib/backend/context.ts";
import { advanceJobs, hasPendingJobs } from "../src/lib/backend/jobs.ts";
import type { User } from "../src/schemas/index.ts";
const db = createSupabaseAdminClient();
const actor: User = {
  id: "system",
  name: "Background worker",
  email: "worker@example.test",
  role: "admin",
  locale: "en",
};
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
console.log("Smart QS durable job worker started.");
while (running) {
  try {
    if (await hasPendingJobs(db)) {
      const snapshot = await loadSnapshot(db);
      const { ctx, events } = createPersistentContext(
        decodeState(snapshot.records),
        actor,
      );
      advanceJobs(
        ctx,
        Date.now(),
        process.env.SMART_QS_DEMO_PROCESSING === "enabled",
      );
      await commitContext(db, ctx, snapshot.records, snapshot.revision, events);
    }
  } catch {
    console.error(
      "Job cycle could not commit; it will retry from persisted state.",
    );
  }
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, 2000));
}
