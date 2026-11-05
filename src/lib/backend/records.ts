import { z } from "zod";
import * as s from "@/schemas";
import type { DomainState } from "@/lib/domain/context";
export const collections = {
  projects: ["projects", s.projectSchema],
  documents: ["documents", s.hubDocumentSchema],
  versions: ["document_versions", s.documentVersionSchema],
  conflicts: ["version_conflicts", s.versionConflictSchema],
  comparisons: ["drawing_comparisons", s.drawingComparisonSchema],
  changes: ["drawing_changes", s.drawingChangeSchema],
  variations: ["variation_events", s.variationEventSchema],
  workbooks: ["workbooks", s.workbookSchema],
  workbookVersions: ["workbook_versions", s.workbookVersionSchema],
  checks: ["workbook_checks", s.workbookCheckSchema],
  items: ["boq_items", s.boqItemSchema],
  materials: ["materials", s.materialSchema],
  forecasts: ["price_forecasts", s.priceForecastSchema],
  procurement: ["procurement_advice", s.procurementAdviceSchema],
  materialNeeds: ["material_needs", s.projectMaterialNeedSchema],
  links: ["entity_links", s.entityLinkSchema],
  auditEvents: ["audit_events", s.auditEventSchema],
} as const;
export interface RecordRow {
  table: string;
  id: string;
  projectId: string | null;
  data: unknown;
  inactive?: boolean;
}
export const snapshotSchema = z.object({
  revision: z.number().int(),
  records: z.array(
    z.object({
      table: z.string(),
      id: z.string(),
      projectId: z.string().nullable(),
      data: z.unknown(),
    }),
  ),
});
export function emptyState(): DomainState {
  return {
    projects: [],
    documents: [],
    versions: [],
    conflicts: [],
    comparisons: [],
    changes: [],
    variations: [],
    workbooks: [],
    workbookVersions: [],
    checks: [],
    items: [],
    materials: [],
    forecasts: [],
    procurement: [],
    materialNeeds: [],
    links: [],
    auditEvents: [],
    parsed: {},
    filePaths: {},
  };
}
export function projectFor(
  state: DomainState,
  type: string,
  id: string,
): string | null {
  const d = state.documents.find((d) => d.id === id),
    w = state.workbooks.find((w) => w.id === id);
  if (type === "project") return id;
  if (type === "document") return d?.projectId ?? null;
  if (type === "document_version") {
    const v = state.versions.find((v) => v.id === id);
    return v ? projectFor(state, "document", v.documentId) : null;
  }
  if (type === "workbook") return w?.projectId ?? null;
  if (type === "workbook_version") {
    const v = state.workbookVersions.find((v) => v.id === id);
    return v ? projectFor(state, "workbook", v.workbookId) : null;
  }
  if (type === "boq_item") {
    const i = state.items.find((i) => i.id === id);
    return i
      ? projectFor(state, "workbook_version", i.workbookVersionId)
      : null;
  }
  if (type === "check") {
    const c = state.checks.find((c) => c.id === id);
    return c ? projectFor(state, "workbook_version", c.versionId) : null;
  }
  if (type === "comparison")
    return state.comparisons.find((c) => c.id === id)?.projectId ?? null;
  if (type === "change") {
    const c = state.changes.find((c) => c.id === id);
    return c ? projectFor(state, "comparison", c.comparisonId) : null;
  }
  if (type === "variation")
    return state.variations.find((v) => v.id === id)?.projectId ?? null;
  if (type === "procurement")
    return state.procurement.find((p) => p.id === id)?.projectId ?? null;
  return null;
}
const entityTypes: Record<string, string> = {
  documents: "document",
  versions: "document_version",
  comparisons: "comparison",
  changes: "change",
  variations: "variation",
  workbooks: "workbook",
  workbookVersions: "workbook_version",
  checks: "check",
  items: "boq_item",
  procurement: "procurement",
};
export function encodeState(state: DomainState): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const [key, [table, schema]] of Object.entries(collections)) {
    for (const raw of state[key as keyof typeof collections]) {
      const data = schema.parse(raw) as Record<string, unknown>;
      const id =
        typeof data.id === "string"
          ? data.id
          : key === "forecasts"
            ? String(data.materialId)
            : key === "materialNeeds"
              ? `${data.projectId}:${data.materialId}:${data.source}`
              : key === "links"
                ? `${(raw as s.EntityLink).from.type}:${(raw as s.EntityLink).from.id}:${(raw as s.EntityLink).to.type}:${(raw as s.EntityLink).to.id}`
                : "";
      const projectId =
        key === "projects"
          ? id
          : typeof data.projectId === "string"
            ? data.projectId
            : key === "auditEvents"
              ? projectFor(
                  state,
                  (raw as s.AuditEvent).entityType,
                  (raw as s.AuditEvent).entityId,
                )
              : key === "links"
                ? (projectFor(
                    state,
                    (raw as s.EntityLink).from.type,
                    (raw as s.EntityLink).from.id,
                  ) ??
                  projectFor(
                    state,
                    (raw as s.EntityLink).to.type,
                    (raw as s.EntityLink).to.id,
                  ))
                : projectFor(state, entityTypes[key] ?? "", id);
      rows.push({ table, id, projectId, data });
    }
  }
  for (const [id, data] of Object.entries(state.parsed))
    rows.push({
      table: "parsed_workbooks",
      id,
      projectId: projectFor(state, "workbook_version", id),
      data,
    });
  return rows;
}
const parsedSchema = z.object({
  sheetNames: z.array(z.string()),
  items: z.array(s.boqItemSchema),
  checks: z.array(s.workbookCheckSchema),
  sheets: z.record(
    z.string(),
    z.array(
      z.object({
        row: z.number(),
        cells: z.array(
          z.object({
            column: z.string(),
            value: z.union([z.string(), z.number(), z.null()]),
            formula: z.string().optional(),
          }),
        ),
      }),
    ),
  ),
  totals: z.array(z.object({ sheet: z.string(), amount: z.number() })),
});
export function decodeState(rows: RecordRow[]): DomainState {
  const state = emptyState();
  for (const [key, [table, schema]] of Object.entries(collections))
    Reflect.set(
      state,
      key,
      rows.filter((r) => r.table === table).map((r) => schema.parse(r.data)),
    );
  for (const row of rows.filter((r) => r.table === "parsed_workbooks"))
    state.parsed[row.id] = parsedSchema.parse(row.data);
  state.versions.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  state.workbookVersions.sort((a, b) =>
    a.uploadedAt.localeCompare(b.uploadedAt),
  );
  state.comparisons.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  state.changes.sort((a, b) => a.number - b.number);
  state.items.sort(
    (a, b) =>
      a.workbookVersionId.localeCompare(b.workbookVersionId) ||
      a.sheet.localeCompare(b.sheet) ||
      a.row - b.row,
  );
  return state;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export function diffRecords(
  before: RecordRow[],
  after: RecordRow[],
): RecordRow[] {
  const key = (r: RecordRow) => `${r.table}:${r.id}`,
    prev = new Map(before.map((r) => [key(r), r])),
    next = new Set(after.map(key));
  return [
    ...after.filter((r) => canonical(prev.get(key(r))) !== canonical(r)),
    ...before
      .filter((r) => !next.has(key(r)))
      .map((r) => ({ ...r, inactive: true })),
  ];
}
