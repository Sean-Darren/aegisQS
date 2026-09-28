import { http } from "msw";
import { z } from "zod";
import {
  analysisJobSchema,
  auditorKindSchema,
  reportSchema,
  signReportInputSchema,
} from "@/schemas";
import {
  db,
  nextId,
  now,
  currentUser,
  audit,
  signedFlagIds,
  signedDocumentIds,
} from "../store";
import { provenance } from "../fixtures/data";
import { retryFailedAuditor, startAnalysis } from "../ws/simulation";
import { json, projectGuard, allowed, input, failure } from "./shared";
export const jobReportHandlers = [
  http.post("*/api/v1/projects/:projectId/analysis-jobs", ({ params }) => {
    const id = String(params.projectId);
    const denied = projectGuard(id, "analysis.run");
    if (denied) return denied;
    if (
      !db.documents.some(
        (document) =>
          document.projectId === id &&
          document.type === "priced_boq" &&
          document.parseStatus === "parsed",
      )
    )
      return failure(
        409,
        "PRICED_BOQ_REQUIRED",
        "Upload and parse a priced BOQ before running analysis.",
      );
    if (
      db.jobs.some(
        (j) => j.projectId === id && ["queued", "running"].includes(j.status),
      )
    )
      return failure(409, "JOB_RUNNING", "An analysis job is already running.");
    const job = startAnalysis(id);
    audit("job.started", "job", job.id);
    return json(analysisJobSchema, job, 202);
  }),
  http.get("*/api/v1/analysis-jobs/:jobId", ({ params }) => {
    const denied = allowed("project.view");
    if (denied) return denied;
    const job = db.jobs.find((j) => j.id === params.jobId);
    return job
      ? json(analysisJobSchema, job)
      : failure(404, "NOT_FOUND", "Analysis job not found.");
  }),
  http.post(
    "*/api/v1/analysis-jobs/:jobId/auditors/:tendererId/:auditor/retry",
    ({ params }) => {
      const job = db.jobs.find((item) => item.id === params.jobId);
      if (!job) return failure(404, "NOT_FOUND", "Analysis job not found.");
      const denied = projectGuard(job.projectId, "analysis.run");
      if (denied) return denied;
      const auditor = auditorKindSchema.safeParse(params.auditor);
      if (!auditor.success)
        return failure(400, "INVALID_AUDITOR", "Select a valid auditor.");
      if (!retryFailedAuditor(job, String(params.tendererId), auditor.data))
        return failure(
          409,
          "NOT_FAILED",
          "Only a failed auditor in a finished job can be retried.",
        );
      return json(analysisJobSchema, job, 202);
    },
  ),
  http.get("*/api/v1/projects/:projectId/reports", ({ params }) => {
    const id = String(params.projectId);
    const denied = projectGuard(id, "report.viewSigned");
    if (denied) return denied;
    const signedOnly = !!allowed("project.view");
    return json(
      z.array(reportSchema),
      db.reports.filter(
        (r) => r.projectId === id && (!signedOnly || r.status === "signed"),
      ),
    );
  }),
  http.post(
    "*/api/v1/projects/:projectId/reports",
    async ({ params, request }) => {
      const id = String(params.projectId);
      const denied = projectGuard(id, "report.sign");
      if (denied) return denied;
      const parsed = await input(request, signReportInputSchema);
      if (!parsed.success)
        return failure(
          400,
          "INVALID_BODY",
          "Provide a recommended tenderer and a valid override reason when needed.",
        );
      if (
        !db.tenderers.some(
          (t) =>
            t.projectId === id && t.id === parsed.data.recommendedTendererId,
        )
      )
        return failure(
          400,
          "INVALID_TENDERER",
          "Tenderer does not belong to this project.",
        );
      if (
        parsed.data.recommendedTendererId !== db.kpis.recommendedTendererId &&
        !parsed.data.overrideReason
      )
        return failure(
          400,
          "OVERRIDE_REASON_REQUIRED",
          "A recommendation override requires a reason.",
        );
      if (
        db.jobs.some(
          (j) => j.projectId === id && ["queued", "running"].includes(j.status),
        )
      )
        return failure(
          409,
          "JOB_RUNNING",
          "Wait for analysis to finish before sign-off.",
        );
      const blockers = db.flags.filter(
        (f) =>
          f.projectId === id &&
          f.evidence.length > 0 &&
          ["critical", "high"].includes(f.severity) &&
          !f.decision,
      ).length;
      if (blockers)
        return failure(
          409,
          "UNRESOLVED_FLAGS",
          `${blockers} high or critical flags require a final decision.`,
        );
      const latest = db.jobs.find(
        (j) => j.id === db.projects.find((p) => p.id === id)?.latestJobId,
      );
      const report = reportSchema.parse({
        id: nextId("R"),
        projectId: id,
        version:
          Math.max(
            0,
            ...db.reports
              .filter((r) => r.projectId === id)
              .map((r) => r.version),
          ) + 1,
        status: "signed",
        signedBy: currentUser().id,
        signedAt: now(),
        ...parsed.data,
        ...provenance,
        ...(latest
          ? {
              modelVersion: latest.modelVersion,
              toolSchemaVersion: latest.toolSchemaVersion,
            }
          : {}),
      });
      db.reports.push(report);
      for (const flag of db.flags.filter((flag) => flag.projectId === id)) {
        signedFlagIds.add(flag.id);
        for (const evidence of flag.evidence)
          signedDocumentIds.add(evidence.documentId);
      }
      audit("report.signed", "report", report.id, { version: report.version });
      return json(reportSchema, report, 201);
    },
  ),
];
