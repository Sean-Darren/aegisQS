import { z } from "zod";
import { drawingComparisonSchema } from "./drawing";
import { checkSummarySchema } from "./workbook";
export const wsEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("comparison.progress"),
    comparisonId: z.string(),
    status: drawingComparisonSchema.shape.status,
    progressPct: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("comparison.completed"),
    comparisonId: z.string(),
    status: z.enum(["succeeded", "failed"]),
    changeCount: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("document.version_added"),
    documentId: z.string(),
    versionId: z.string(),
    conflict: z.boolean(),
  }),
  z.object({
    type: z.literal("workbook.checked"),
    workbookId: z.string(),
    versionId: z.string(),
    checkSummary: checkSummarySchema.optional(),
  }),
]);
export type WsEvent = z.infer<typeof wsEventSchema>;
