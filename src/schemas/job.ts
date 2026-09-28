import { z } from "zod";
import { auditorKindSchema, isoDateTimeSchema } from "./enums";
export const auditorStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
]);
export const analysisJobSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: jobStatusSchema,
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.optional(),
  progress: z.array(
    z.object({
      tendererId: z.string(),
      auditor: auditorKindSchema,
      status: auditorStatusSchema,
      pct: z.number().min(0).max(100),
      error: z.string().optional(),
    }),
  ),
  modelVersion: z.string(),
  toolSchemaVersion: z.string(),
});
export type AnalysisJob = z.infer<typeof analysisJobSchema>;
