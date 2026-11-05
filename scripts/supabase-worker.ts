import { createSupabaseAdminClient } from "../src/lib/supabase/admin.ts";
import { loadSnapshot, commitContext } from "../src/lib/backend/repository.ts";
import { decodeState } from "../src/lib/backend/records.ts";
import { createPersistentContext } from "../src/lib/backend/context.ts";
import {
  advanceJobs,
  advanceWorkbooks,
  hasPendingJobs,
} from "../src/lib/backend/jobs.ts";
import {
  hasRevisionWorker,
  runRevisionWorker,
} from "../src/lib/backend/revision-analyzer.ts";
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
      const now = Date.now();

      if (hasRevisionWorker()) {
        for (const comparison of ctx.state.comparisons.filter(
          (c) => !["succeeded", "failed"].includes(c.status),
        )) {
          try {
            await runRevisionWorker(db, ctx, comparison);
          } catch (error) {
            comparison.status = "failed";
            comparison.error =
              error instanceof Error
                ? error.message
                : "Hugging Face revision comparison failed.";
            comparison.finishedAt = ctx.now();
            ctx.audit(
              "comparison.failed",
              "comparison",
              comparison.id,
              comparison.error,
            );
            ctx.emit(comparison.projectId, {
              type: "comparison.completed",
              comparisonId: comparison.id,
              status: "failed",
              changeCount: 0,
            });
          }
        }
        advanceWorkbooks(ctx, now);
      } else {
        advanceJobs(
          ctx,
          now,
          process.env.SMART_QS_DEMO_PROCESSING === "enabled",
        );
      }

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
