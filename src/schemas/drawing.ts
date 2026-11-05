import { z } from "zod";
import { bboxSchema, isoDateSchema } from "./enums";
export const changeKindSchema = z.enum([
  "added",
  "removed",
  "modified",
  "dimension",
  "annotation",
]);
export const changeStatusSchema = z.enum([
  "new",
  "no_variation",
  "potential_variation",
]);
export const drawingComparisonSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  documentId: z.string(),
  baseVersionId: z.string(),
  targetVersionId: z.string(),
  status: z.enum(["queued", "aligning", "detecting", "succeeded", "failed"]),
  progressPct: z.number().min(0).max(100),
  error: z.string().optional(),
  alignment: z.object({
    dx: z.number(),
    dy: z.number(),
    scale: z.number().positive(),
    rotationDeg: z.number(),
    method: z.enum(["auto", "manual"]),
    quality: z.number().min(0).max(1),
  }),
  pageCount: z.number().int().positive(),
  changeCounts: z.record(changeKindSchema, z.number().int().nonnegative()),
  modelVersion: z.string(),
  createdAt: isoDateSchema,
  finishedAt: isoDateSchema.optional(),
});
export const drawingChangeSchema = z.object({
  id: z.string(),
  comparisonId: z.string(),
  number: z.number().int().positive(),
  page: z.number().int().positive(),
  bbox: bboxSchema,
  kind: changeKindSchema,
  summary: z.string(),
  textBefore: z.string().optional(),
  textAfter: z.string().optional(),
  confidence: z.number().min(0).max(1),
  status: changeStatusSchema,
  review: z
    .object({ by: z.string(), at: isoDateSchema, note: z.string().optional() })
    .optional(),
  variationEventId: z.string().optional(),
});
export type ChangeKind = z.infer<typeof changeKindSchema>;
export type ChangeStatus = z.infer<typeof changeStatusSchema>;
export type DrawingComparison = z.infer<typeof drawingComparisonSchema>;
export type DrawingChange = z.infer<typeof drawingChangeSchema>;
