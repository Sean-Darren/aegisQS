import type { AuditorKind, Flag, Severity, SignalKey } from "@/schemas";

export type InboxFilters = {
  severity: Severity | "all";
  status: Flag["status"] | "all";
  tendererId: string;
  auditor: AuditorKind | "all";
  signal: SignalKey | "all";
  assignee: string;
  preset: "all" | "needsDecision" | "criticalHigh";
};

export const initialInboxFilters: InboxFilters = {
  severity: "all",
  status: "all",
  tendererId: "",
  auditor: "all",
  signal: "all",
  assignee: "all",
  preset: "all",
};

export function filterInboxFlags(
  flags: Flag[],
  filters: InboxFilters,
  userId: string,
) {
  return flags.filter((flag) => {
    if (filters.severity !== "all" && flag.severity !== filters.severity)
      return false;
    if (filters.status !== "all" && flag.status !== filters.status)
      return false;
    if (filters.tendererId && flag.tendererId !== filters.tendererId)
      return false;
    if (filters.auditor !== "all" && flag.auditor !== filters.auditor)
      return false;
    if (filters.signal !== "all" && flag.signal !== filters.signal)
      return false;
    if (filters.assignee === "mine" && flag.assigneeId !== userId) return false;
    if (filters.assignee === "unassigned" && flag.assigneeId) return false;
    if (
      !["all", "mine", "unassigned"].includes(filters.assignee) &&
      flag.assigneeId !== filters.assignee
    )
      return false;
    if (
      filters.preset === "needsDecision" &&
      (flag.assigneeId !== userId || !!flag.decision)
    )
      return false;
    if (
      filters.preset === "criticalHigh" &&
      !["critical", "high"].includes(flag.severity)
    )
      return false;
    return true;
  });
}

export function flagInboxStats(flags: Flag[]) {
  const severity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  let blocking = 0;
  let decided = 0;
  for (const flag of flags) {
    severity[flag.severity] += 1;
    if (flag.decision) decided += 1;
    if (
      flag.evidence.length > 0 &&
      !flag.decision &&
      (flag.severity === "critical" || flag.severity === "high")
    )
      blocking += 1;
  }
  return { severity, blocking, decided };
}

export function canBulkProposeDismiss(flag: Flag) {
  return flag.severity === "low" && !flag.decision && flag.evidence.length > 0;
}
