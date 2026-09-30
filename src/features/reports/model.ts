import type { Flag, ProjectKpis, Report } from "@/schemas";

const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function signOffBlockers(flags: Flag[]) {
  return flags.filter(
    (flag) =>
      flag.evidence.length > 0 &&
      (flag.severity === "critical" || flag.severity === "high") &&
      !flag.decision,
  );
}

export function citedFlags(flags: Flag[]) {
  return flags
    .filter((flag) => flag.evidence.length > 0)
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export function reportRecommendation(
  report: Pick<Report, "recommendedTendererId"> | undefined,
  kpis: Pick<ProjectKpis, "recommendedTendererId">,
) {
  return report?.recommendedTendererId ?? kpis.recommendedTendererId ?? "";
}

export function validOverride(
  selectedTendererId: string,
  defaultTendererId: string | undefined,
  reason: string,
) {
  return selectedTendererId === defaultTendererId || reason.trim().length >= 10;
}
