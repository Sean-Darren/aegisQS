import type { FlagFilters } from "@/schemas";
export type RateGridFilters = {
  cursor?: string;
  trade?: string;
  flaggedOnly?: boolean;
};
export const queryKeys = {
  me: () => ["me"] as const,
  projects: () => ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  documents: (id: string) => ["projects", id, "documents"] as const,
  tenderers: (id: string) => ["projects", id, "tenderers"] as const,
  bids: (id: string) => ["projects", id, "bids"] as const,
  kpis: (id: string) => ["projects", id, "kpis"] as const,
  scores: (id: string) => ["projects", id, "scores"] as const,
  priceDistribution: (id: string) =>
    ["projects", id, "price-distribution"] as const,
  rateGrids: (id: string) => ["projects", id, "rate-grid"] as const,
  rateGrid: (id: string, filters: RateGridFilters = {}) =>
    ["projects", id, "rate-grid", filters] as const,
  flags: (id: string) => ["projects", id, "flags"] as const,
  flagList: (id: string, filters: FlagFilters = {}) =>
    ["projects", id, "flags", filters] as const,
  flag: (id: string) => ["flags", id] as const,
  jobs: () => ["analysis-jobs"] as const,
  job: (id: string) => ["analysis-jobs", id] as const,
  scopeGaps: (id: string) => ["projects", id, "scope-gaps"] as const,
  reports: (id: string) => ["projects", id, "reports"] as const,
  auditEvents: (id: string, cursor?: string) =>
    ["projects", id, "audit-events", { cursor }] as const,
  documentFile: (id: string) => ["documents", id, "file"] as const,
};
