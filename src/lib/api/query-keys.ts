export type QueryFilters = Record<
  string,
  string | number | boolean | undefined
>;
export const queryKeys = {
  me: () => ["me"] as const,
  projects: () => ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  overview: (id: string) => ["projects", id, "overview"] as const,
  documents: (id: string, filters: QueryFilters = {}) =>
    ["projects", id, "documents", filters] as const,
  document: (id: string) => ["documents", id] as const,
  versions: (id: string) => ["documents", id, "versions"] as const,
  conflicts: (id: string) => ["documents", id, "conflicts"] as const,
  links: (id: string, filters: QueryFilters = {}) =>
    ["projects", id, "links", filters] as const,
  drawings: (id: string) => ["projects", id, "drawings"] as const,
  comparison: (id: string) => ["comparisons", id] as const,
  changes: (id: string, filters: QueryFilters = {}) =>
    ["comparisons", id, "changes", filters] as const,
  variations: (id: string, filters: QueryFilters = {}) =>
    ["projects", id, "variations", filters] as const,
  variation: (id: string) => ["variations", id] as const,
  workbooks: (id: string) => ["projects", id, "workbooks"] as const,
  workbook: (id: string) => ["workbooks", id] as const,
  workbookVersion: (id: string) => ["workbook-versions", id] as const,
  checks: (id: string, filters: QueryFilters = {}) =>
    ["workbook-versions", id, "checks", filters] as const,
  items: (id: string, filters: QueryFilters = {}) =>
    ["workbook-versions", id, "items", filters] as const,
  sheet: (id: string, filters: QueryFilters = {}) =>
    ["workbook-versions", id, "sheet", filters] as const,
  diff: (id: string, base: string, target: string) =>
    ["workbooks", id, "diff", base, target] as const,
  boqItems: (id: string, q = "") => ["projects", id, "boq-items", q] as const,
  materials: (filters: QueryFilters = {}) => ["materials", filters] as const,
  forecast: (id: string) => ["materials", id, "forecast"] as const,
  materialNeeds: (id: string) => ["projects", id, "material-needs"] as const,
  procurement: (id: string) => ["projects", id, "procurement"] as const,
  auditEvents: (id: string, filters: QueryFilters = {}) =>
    ["projects", id, "audit-events", filters] as const,
};
