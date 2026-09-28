import { z } from "zod";
import * as s from "@/schemas";
import { apiClient, type createApiClient } from "./client";
import type { RateGridFilters } from "./query-keys";
function query(values: Record<string, string | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
const id = encodeURIComponent;
export function createResources(
  client: ReturnType<typeof createApiClient> = apiClient,
) {
  const project = (projectId: string) => `/projects/${id(projectId)}`;
  return {
    me: () => client.get("/me", s.userSchema),
    projects: () => client.get("/projects", z.array(s.projectSchema)),
    project: (projectId: string) =>
      client.get(project(projectId), s.projectSchema),
    documents: (projectId: string) =>
      client.get(
        `${project(projectId)}/documents`,
        z.array(s.projectDocumentSchema),
      ),
    uploadDocument: (
      projectId: string,
      file: File,
      type: s.DocumentType,
      tendererId?: string,
    ) => {
      const form = new FormData();
      form.set("file", file);
      form.set("type", type);
      if (tendererId) form.set("tendererId", tendererId);
      return client.post(
        `${project(projectId)}/documents`,
        s.projectDocumentSchema,
        form,
      );
    },
    runAnalysis: (projectId: string) =>
      client.post(
        `${project(projectId)}/analysis-jobs`,
        s.analysisJobSchema,
        {},
      ),
    job: (jobId: string) =>
      client.get(`/analysis-jobs/${id(jobId)}`, s.analysisJobSchema),
    tenderers: (projectId: string) =>
      client.get(`${project(projectId)}/tenderers`, z.array(s.tendererSchema)),
    bids: (projectId: string) =>
      client.get(`${project(projectId)}/bids`, z.array(s.bidSchema)),
    kpis: (projectId: string) =>
      client.get(`${project(projectId)}/kpis`, s.projectKpisSchema),
    scores: (projectId: string) =>
      client.get(
        `${project(projectId)}/scores`,
        z.array(s.complianceScoreSchema),
      ),
    priceDistribution: (projectId: string) =>
      client.get(
        `${project(projectId)}/price-distribution`,
        s.priceDistributionSchema,
      ),
    rateGrid: (projectId: string, filters: RateGridFilters = {}) =>
      client.get(
        `${project(projectId)}/rate-grid${query(filters)}`,
        s.rateGridPageSchema,
      ),
    flags: (projectId: string, filters: s.FlagFilters = {}) =>
      client.get(
        `${project(projectId)}/flags${query(filters)}`,
        z.array(s.flagSchema),
      ),
    flag: (flagId: string) => client.get(`/flags/${id(flagId)}`, s.flagSchema),
    propose: (flagId: string, body: s.DispositionInput) =>
      client.post(`/flags/${id(flagId)}/proposal`, s.flagSchema, body),
    decide: (flagId: string, body: s.DispositionInput) =>
      client.post(`/flags/${id(flagId)}/decision`, s.flagSchema, body),
    scopeGaps: (projectId: string) =>
      client.get(`${project(projectId)}/scope-gaps`, z.array(s.scopeGapSchema)),
    reports: (projectId: string) =>
      client.get(`${project(projectId)}/reports`, z.array(s.reportSchema)),
    signReport: (projectId: string, body: s.SignReportInput) =>
      client.post(`${project(projectId)}/reports`, s.reportSchema, body),
    auditEvents: (projectId: string, cursor?: string) =>
      client.page(
        `${project(projectId)}/audit-events${query({ cursor })}`,
        z.array(s.auditEventSchema),
      ),
    documentFile: (documentId: string) =>
      client.file(`/documents/${id(documentId)}/file`),
  };
}
export const resources = createResources();
