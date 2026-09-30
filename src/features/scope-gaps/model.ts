import { thresholds } from "@/lib/config";
import type { Bid, Flag, ProjectDocument, ScopeGap } from "@/schemas";

export const scopeStatuses = [
  "mapped",
  "vague",
  "missing",
  "oversized_ps",
] as const;
export type ScopeStatus = (typeof scopeStatuses)[number];

export function scopeCounts(gaps: ScopeGap[]) {
  return Object.fromEntries(
    scopeStatuses.map((status) => [
      status,
      gaps.filter((gap) => gap.status === status).length,
    ]),
  ) as Record<ScopeStatus, number>;
}

export function hasInspectionReport(documents: ProjectDocument[]) {
  return documents.some((document) => document.type === "inspection_report");
}

export function provisionalSumShare(bid: Bid) {
  if (bid.totalValueHKD <= 0) return null;
  return Math.max(0, Math.min(1, bid.provisionalSumHKD / bid.totalValueHKD));
}

export function exceedsProvisionalSumThreshold(bid: Bid) {
  const share = provisionalSumShare(bid);
  return share !== null && share * 100 > thresholds.provisionalSumPercent;
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;
export function provisionalSumFlagsByTenderer(flags: Flag[]) {
  const result: Record<string, string> = {};
  for (const flag of [...flags]
    .filter(
      (item) =>
        item.signal === "provisional_sum_concentration" &&
        item.tendererId &&
        item.evidence.length > 0,
    )
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])) {
    result[flag.tendererId!] ??= flag.id;
  }
  return result;
}
