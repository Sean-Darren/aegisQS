import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { DomainContext } from "@/lib/domain/context";
import { scheduleComparison } from "@/lib/domain/comparison";
import { summarizeChecks } from "@/lib/domain/workbook-engine";
export function advanceJobs(
  ctx: DomainContext,
  now = Date.now(),
  demoProcessing = false,
) {
  for (const comparison of ctx.state.comparisons.filter(
    (c) => !["succeeded", "failed"].includes(c.status),
  )) {
    if (!demoProcessing) {
      comparison.status = "failed";
      comparison.error =
        "Drawing detection service is not configured. Contact your administrator.";
      comparison.finishedAt = ctx.now();
      ctx.audit(
        "comparison.failed",
        "comparison",
        comparison.id,
        "Drawing detection service is not configured",
      );
      ctx.emit(comparison.projectId, {
        type: "comparison.completed",
        comparisonId: comparison.id,
        status: "failed",
        changeCount: 0,
      });
      continue;
    }
    const elapsed = now - Date.parse(comparison.createdAt),
      previousPct = comparison.progressPct;
    const runner = {
      ...ctx,
      schedule: (cb: () => void, ms: number) => {
        const pct = ms === 1500 ? 20 : ms === 4500 ? 60 : 100;
        if (elapsed >= ms && previousPct < pct) cb();
      },
    };
    scheduleComparison(runner, comparison);
  }
  advanceWorkbooks(ctx, now);
}

export function advanceWorkbooks(
  ctx: DomainContext,
  now = Date.now(),
) {
  for (const version of ctx.state.workbookVersions.filter((v) =>
    ["parsing", "checking"].includes(v.status),
  )) {
    const elapsed = now - Date.parse(version.uploadedAt);
    if (elapsed >= 1000) version.status = "checking";
    if (elapsed < 5000) continue;
    const parsed = ctx.state.parsed[version.id],
      wb = ctx.state.workbooks.find((w) => w.id === version.workbookId);
    if (!parsed || !wb) {
      version.status = "failed";
      continue;
    }
    version.status = "checked";
    version.checkSummary = summarizeChecks(parsed.checks);
    version.totals = parsed.totals;
    ctx.state.checks = ctx.state.checks
      .filter((c) => c.versionId !== version.id)
      .concat(parsed.checks);
    ctx.audit(
      "workbook.checked",
      "workbook_version",
      version.id,
      "Workbook checks completed",
      { checkSummary: version.checkSummary },
    );
    ctx.emit(wb.projectId, {
      type: "workbook.checked",
      workbookId: wb.id,
      versionId: version.id,
      checkSummary: version.checkSummary,
    });
  }
}

/** Idle workers must not repeatedly serialize the complete project dataset. */
export async function hasPendingJobs(db: SupabaseClient): Promise<boolean> {
  const results = await Promise.all([
    db
      .from("drawing_comparisons")
      .select("id")
      .eq("active", true)
      .in("data->>status", ["queued", "aligning", "detecting"])
      .limit(1),
    db
      .from("workbook_versions")
      .select("id")
      .eq("active", true)
      .in("data->>status", ["parsing", "checking"])
      .limit(1),
  ]);
  const rows = z.array(z.object({ id: z.string() }));
  let pending = false;
  for (const result of results) {
    if (result.error) throw new Error("The job queue could not be read.");
    if (rows.parse(result.data).length) pending = true;
  }
  return pending;
}
