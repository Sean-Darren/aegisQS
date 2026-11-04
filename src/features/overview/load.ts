import { resources } from "@/lib/api";
import { fetchAllAuditEvents } from "@/features/audit";
export async function loadOverview(projectId: string) {
  const [
    project,
    documents,
    drawings,
    variations,
    workbooks,
    materials,
    needs,
    advice,
    events,
  ] = await Promise.all([
    resources.project(projectId),
    resources.documents(projectId),
    resources.drawings(projectId),
    resources.variations(projectId),
    resources.workbooks(projectId),
    resources.materials(),
    resources.materialNeeds(projectId),
    resources.procurement(projectId),
    fetchAllAuditEvents((cursor) => resources.auditEvents(projectId, cursor)),
  ]);
  const ids = [
    ...new Set([
      ...drawings.flatMap((d) =>
        d.latestComparison ? [d.latestComparison.id] : [],
      ),
      ...events
        .filter((e) => e.entityType === "comparison")
        .map((e) => e.entityId),
    ]),
  ];
  const comparisons = await Promise.all(
    ids.map((id) => resources.comparison(id)),
  );
  const changes = (
    await Promise.all(ids.map((id) => resources.changes(id)))
  ).flat();
  const checks = await Promise.all(
    workbooks
      .filter((w) => w.currentVersionId)
      .map(async (w) => ({
        workbook: w,
        checks: await resources.checks(w.currentVersionId!),
      })),
  );
  return {
    project,
    documents,
    drawings,
    variations,
    workbooks,
    materials,
    needs,
    advice,
    events,
    comparisons,
    changes,
    checks,
  };
}
export type OverviewData = Awaited<ReturnType<typeof loadOverview>>;
export function summarizeOverview(data: OverviewData, month: string) {
  const potential = data.variations.filter((v) => v.status === "potential");
  const costs = potential.flatMap((v) =>
    v.indicativeCost ? [v.indicativeCost] : [],
  );
  const open = data.checks
    .filter((c) => c.workbook.kind === "boq")
    .flatMap((c) => c.checks)
    .filter((c) => c.status === "open");
  return {
    conflicts: data.documents.filter((d) => d.hasConflict),
    unreviewed: data.changes.filter((c) => c.status === "new"),
    comparisons: data.comparisons.filter(
      (c) => c.createdAt.slice(0, 7) === month,
    ).length,
    potential,
    priced: costs.length,
    low: costs.reduce((n, c) => n + c.low, 0),
    high: costs.reduce((n, c) => n + c.high, 0),
    confirmedPriced: data.variations.filter(
      (v) => v.status === "confirmed" && v.indicativeCost,
    ).length,
    confirmed: data.variations
      .filter((v) => v.status === "confirmed")
      .reduce((n, v) => n + (v.indicativeCost?.total ?? 0), 0),
    confirmedLow: data.variations
      .filter((v) => v.status === "confirmed")
      .reduce((n, v) => n + (v.indicativeCost?.low ?? 0), 0),
    confirmedHigh: data.variations
      .filter((v) => v.status === "confirmed")
      .reduce((n, v) => n + (v.indicativeCost?.high ?? 0), 0),
    errors: open.filter((c) => c.severity === "error").length,
    warnings: open.filter((c) => c.severity === "warning").length,
    rising: data.materials.filter(
      (m) =>
        m.trend === "rising" &&
        data.needs.some((n) => n.materialId === m.id) &&
        !data.advice.some((a) => a.materialId === m.id),
    ),
  };
}
