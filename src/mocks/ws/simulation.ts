import {
  analysisJobSchema,
  auditorKindSchema,
  flagSchema,
  type AnalysisJob,
} from "@/schemas";
import { db, nextId, now, publish, registerCleanup, audit } from "../store";
import { provenance } from "../fixtures/data";
export const ANALYSIS_DURATION_MS = 20000;
export function startAnalysis(projectId: string): AnalysisJob {
  const job = analysisJobSchema.parse({
    id: nextId("J"),
    projectId,
    status: "queued",
    startedAt: now(),
    progress: db.tenderers
      .filter((t) => t.projectId === projectId)
      .flatMap((t) =>
        auditorKindSchema.options.map((auditor) => ({
          tendererId: t.id,
          auditor,
          status: "queued",
          pct: 0,
        })),
      ),
    modelVersion: provenance.modelVersion,
    toolSchemaVersion: provenance.toolSchemaVersion,
  });
  db.jobs.push(job);
  db.projects.find((p) => p.id === projectId)!.latestJobId = job.id;
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    job.status = "running";
    for (const progress of job.progress) {
      const offset = auditorKindSchema.options.indexOf(progress.auditor);
      progress.pct = Math.min(
        100,
        Math.max(0, Math.round(((tick - offset) / (20 - offset)) * 100)),
      );
      progress.status =
        progress.pct === 100
          ? "succeeded"
          : progress.pct === 0
            ? "queued"
            : "running";
      publish(projectId, { type: "job.progress", jobId: job.id, ...progress });
    }
    if ([5, 10, 15].includes(tick)) {
      const source = db.flags[tick / 5 - 1];
      const { decision: _decision, proposal: _proposal, ...base } = source;
      void _decision;
      void _proposal;
      const flag = flagSchema.parse({
        ...base,
        id: nextId("F"),
        status: "open",
        createdAt: now(),
      });
      db.flags.push(flag);
      audit("flag.created", "flag", flag.id);
      publish(projectId, { type: "flag.created", flag });
    }
    if (tick === 20) {
      clearInterval(timer);
      unregister();
      job.status = "succeeded";
      job.finishedAt = new Date(
        Date.parse(job.startedAt) + ANALYSIS_DURATION_MS,
      ).toISOString();
      audit("job.completed", "job", job.id);
      publish(projectId, {
        type: "job.completed",
        jobId: job.id,
        status: job.status,
      });
    }
  }, ANALYSIS_DURATION_MS / 20);
  const unregister = registerCleanup(() => clearInterval(timer));
  return job;
}
