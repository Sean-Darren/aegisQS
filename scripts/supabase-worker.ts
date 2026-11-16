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
// In-memory retry budget per comparison: a transient worker failure
// (network blip, worker restart) should not permanently fail a user's
// drawing comparison.
const comparisonAttempts = new Map<string, number>();
const MAX_COMPARISON_ATTEMPTS = 3;
let consecutiveFailures = 0;
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
            comparisonAttempts.delete(comparison.id);
          } catch (error) {
            const attempts = (comparisonAttempts.get(comparison.id) ?? 0) + 1;
            comparisonAttempts.set(comparison.id, attempts);
            const message =
              error instanceof Error
                ? error.message
                : "Hugging Face revision comparison failed.";
            if (attempts >= MAX_COMPARISON_ATTEMPTS) {
              comparisonAttempts.delete(comparison.id);
              comparison.status = "failed";
              comparison.error = message;
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
            } else {
              // Leave the comparison non-terminal; the next cycle retries.
              comparison.error = message;
              console.warn(
                `Comparison ${comparison.id} failed (attempt ${attempts}/${MAX_COMPARISON_ATTEMPTS}), retrying:`,
                message,
              );
            }
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
  } catch (error) {
    consecutiveFailures += 1;
    console.error(
      "Job cycle could not commit; it will retry from persisted state.",
      error instanceof Error ? error.message : error,
    );
    if (process.argv.includes("--once")) break;
    // Exponential backoff so a persistently broken environment (revoked
    // key, schema drift) does not hammer the database every 2 seconds.
    const backoff = Math.min(2 ** consecutiveFailures, 30) * 1000;
    await new Promise((r) => setTimeout(r, backoff));
    continue;
  }
  consecutiveFailures = 0;
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, 2000));
}
