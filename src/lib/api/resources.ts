import { z } from "zod";
import * as s from "@/schemas";
import type { BuildingType } from "@/schemas";
import {
  apiClient,
  type createApiClient,
  type ApiRequestOptions,
} from "./client";
import type { QueryFilters } from "./query-keys";
export function query(values: QueryFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
const id = encodeURIComponent;
export type DocumentFilters = {
  category?: s.DocumentCategory;
  q?: string;
  discipline?: s.Discipline;
  conflict?: boolean;
};
export type AuditQuery = {
  entityType?: s.AuditEvent["entityType"];
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  /** Single-shot bounded fetch (no cursor walk). Max 500 on the server. */
  limit?: number;
};
export function createResources(
  client: ReturnType<typeof createApiClient> = apiClient,
) {
  const project = (p: string) => `/projects/${id(p)}`;
  return {
    me: () => client.get("/me", s.userSchema),
    projects: () => client.get("/projects", z.array(s.projectSchema)),
    project: (p: string) => client.get(project(p), s.projectSchema),
    createProject: (body: {
      name: string;
      code?: string;
      location?: string | null;
      buildingType?: BuildingType | null;
    }) => client.post("/projects", s.projectSchema, body),
    updateProject: (
      p: string,
      body: {
        name?: string;
        code?: string;
        location?: string | null;
        buildingType?: BuildingType | null;
      },
    ) => client.patch(project(p), s.projectSchema, body),
    deleteProject: (p: string) => client.delete(project(p), s.projectSchema),
    overview: (p: string) =>
      client.get(`${project(p)}/overview`, s.projectOverviewSchema),
    documents: (p: string, filters: DocumentFilters = {}) =>
      client.get(
        `${project(p)}/documents${query(filters)}`,
        z.array(s.hubDocumentSchema),
      ),
    uploadDocument: (
      p: string,
      form: FormData,
      options?: ApiRequestOptions & { onProgress?: (percent: number) => void },
    ) =>
      client.upload(
        `${project(p)}/documents`,
        s.hubDocumentSchema,
        form,
        options,
      ),
    document: (d: string) =>
      client.get(`/documents/${id(d)}`, s.hubDocumentSchema),
    versions: (d: string) =>
      client.get(
        `/documents/${id(d)}/versions`,
        z.array(s.documentVersionSchema),
      ),
    uploadVersion: (
      d: string,
      form: FormData,
      options?: ApiRequestOptions & { onProgress?: (percent: number) => void },
    ) =>
      client.upload(
        `/documents/${id(d)}/versions`,
        s.documentVersionSchema,
        form,
        options,
      ),
    setCurrent: (d: string, body: { versionId: string; reason: string }) =>
      client.post(`/documents/${id(d)}/current`, s.hubDocumentSchema, body),
    conflicts: (d: string) =>
      client.get(
        `/documents/${id(d)}/conflicts`,
        z.array(s.versionConflictSchema),
      ),
    documentFile: (v: string) =>
      client.file(`/document-versions/${id(v)}/file`),
    links: (
      p: string,
      filters: { type?: s.EntityLink["from"]["type"]; id?: string } = {},
    ) =>
      client.get(
        `${project(p)}/links${query(filters)}`,
        z.array(s.entityLinkSchema),
      ),
    drawings: (p: string) =>
      client.get(
        `${project(p)}/drawings`,
        z.array(s.drawingRegisterEntrySchema),
      ),
    runComparison: (
      p: string,
      body: Pick<
        s.DrawingComparison,
        "documentId" | "baseVersionId" | "targetVersionId"
      >,
    ) =>
      client.post(`${project(p)}/comparisons`, s.drawingComparisonSchema, body),
    comparison: (c: string) =>
      client.get(`/comparisons/${id(c)}`, s.drawingComparisonSchema),
    updateAlignment: (
      c: string,
      body: Pick<
        s.DrawingComparison["alignment"],
        "dx" | "dy" | "scale" | "rotationDeg"
      >,
    ) =>
      client.patch(
        `/comparisons/${id(c)}/alignment`,
        s.drawingComparisonSchema,
        body,
      ),
    changes: (
      c: string,
      filters: { kind?: s.ChangeKind; status?: s.ChangeStatus } = {},
    ) =>
      client.get(
        `/comparisons/${id(c)}/changes${query(filters)}`,
        z.array(s.drawingChangeSchema),
      ),
    reviewChange: (
      c: string,
      body: { status: s.ChangeStatus; note?: string },
    ) => client.patch(`/changes/${id(c)}`, s.drawingChangeSchema, body),
    variations: (p: string, status?: s.VariationStatus) =>
      client.get(
        `${project(p)}/variations${query({ status })}`,
        z.array(s.variationEventSchema),
      ),
    raiseVariation: (
      p: string,
      body: Pick<
        s.VariationEvent,
        "title" | "sourceChangeIds" | "comparisonId"
      >,
    ) => client.post(`${project(p)}/variations`, s.variationEventSchema, body),
    variation: (v: string) =>
      client.get(`/variations/${id(v)}`, s.variationEventSchema),
    updateCostLines: (v: string, costLines: s.CostLine[]) =>
      client.put(`/variations/${id(v)}/cost-lines`, s.variationEventSchema, {
        costLines,
      }),
    decideVariation: (
      v: string,
      body: { status: "confirmed" | "rejected"; reason: string },
    ) =>
      client.post(
        `/variations/${id(v)}/decision`,
        s.variationEventSchema,
        body,
      ),
    workbooks: (p: string) =>
      client.get(`${project(p)}/workbooks`, z.array(s.workbookSchema)),
    uploadWorkbook: (
      p: string,
      form: FormData,
      options?: ApiRequestOptions & { onProgress?: (percent: number) => void },
    ) =>
      client.upload(`${project(p)}/workbooks`, s.workbookSchema, form, options),
    workbook: (w: string) =>
      client.get(`/workbooks/${id(w)}`, s.workbookSchema),
    uploadWorkbookVersion: (
      w: string,
      form: FormData,
      options?: ApiRequestOptions & { onProgress?: (percent: number) => void },
    ) =>
      client.upload(
        `/workbooks/${id(w)}/versions`,
        s.workbookVersionSchema,
        form,
        options,
      ),
    updateMapping: (w: string, mapping: s.ColumnMapping) =>
      client.put(`/workbooks/${id(w)}/mapping`, s.workbookSchema, { mapping }),
    workbookVersion: (v: string) =>
      client.get(`/workbook-versions/${id(v)}`, s.workbookVersionSchema),
    checks: (
      v: string,
      filters: {
        severity?: s.WorkbookCheck["severity"];
        rule?: s.CheckRule;
        status?: s.WorkbookCheck["status"];
      } = {},
    ) =>
      client.get(
        `/workbook-versions/${id(v)}/checks${query(filters)}`,
        z.array(s.workbookCheckSchema),
      ),
    resolveCheck: (
      c: string,
      body: { status: s.WorkbookCheck["status"]; reason?: string },
    ) => client.patch(`/checks/${id(c)}`, s.workbookCheckSchema, body),
    items: (
      v: string,
      filters: { q?: string; section?: string; cursor?: string } = {},
    ) =>
      client.page(
        `/workbook-versions/${id(v)}/items${query(filters)}`,
        z.array(s.boqItemSchema),
      ),
    sheet: (
      v: string,
      filters: { sheet?: string; fromRow?: number; toRow?: number } = {},
    ) =>
      client.get(
        `/workbook-versions/${id(v)}/sheet${query(filters)}`,
        s.sheetPreviewSchema,
      ),
    diff: (w: string, base: string, target: string) =>
      client.get(
        `/workbooks/${id(w)}/diff${query({ base, target })}`,
        s.workbookDiffSchema,
      ),
    downloadWorkbook: (v: string, annotated = false) =>
      client.file(
        `/workbook-versions/${id(v)}/download${query({ annotated })}`,
      ),
    boqItems: (p: string, q?: string) =>
      client.get(
        `${project(p)}/boq-items${query({ q })}`,
        z.array(s.boqItemSchema),
      ),
    materials: (
      filters: { category?: s.Material["category"]; q?: string } = {},
    ) => client.get(`/materials${query(filters)}`, z.array(s.materialSchema)),
    forecast: (m: string) =>
      client.get(`/materials/${id(m)}/forecast`, s.priceForecastSchema),
    materialNeeds: (p: string) =>
      client.get(
        `${project(p)}/material-needs`,
        z.array(s.projectMaterialNeedSchema),
      ),
    extractMaterialNeeds: (p: string, documentId: string) =>
      client.post(
        `${project(p)}/material-needs/extract/${id(documentId)}`,
        z.array(s.projectMaterialNeedSchema),
        {},
      ),
    procurement: (p: string) =>
      client.get(
        `${project(p)}/procurement`,
        z.array(s.procurementAdviceSchema),
      ),
    createProcurement: (
      p: string,
      body: Pick<
        s.ProcurementAdvice,
        "materialId" | "quantity" | "neededBy" | "leadTimeWeeks"
      >,
    ) =>
      client.post(`${project(p)}/procurement`, s.procurementAdviceSchema, body),
    auditEvents: (p: string, cursor?: string, filters: AuditQuery = {}) =>
      client.page(
        `${project(p)}/audit-events${query({ ...filters, cursor })}`,
        z.array(s.auditEventSchema),
      ),
  };
}
export const resources = createResources();
