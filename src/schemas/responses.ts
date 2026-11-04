// Endpoint envelopes approved 4 November 2026; §7 entities remain unchanged.
import { z } from "zod";
import { auditEventSchema } from "./audit";
import { hubDocumentSchema } from "./document";
import { drawingComparisonSchema } from "./drawing";
export const projectOverviewSchema = z.object({
  counts: z.object({
    documents: z.number().int().nonnegative(),
    drawings: z.number().int().nonnegative(),
    variations: z.number().int().nonnegative(),
    workbooks: z.number().int().nonnegative(),
    openChecks: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(auditEventSchema),
});
export const drawingRegisterEntrySchema = z.object({
  document: hubDocumentSchema,
  latestComparison: drawingComparisonSchema.optional(),
});
export const sheetPreviewSchema = z.object({
  sheet: z.string(),
  fromRow: z.number().int().positive(),
  toRow: z.number().int().positive(),
  rows: z.array(
    z.object({
      row: z.number().int().positive(),
      cells: z.array(
        z.object({
          column: z.string(),
          value: z.union([z.string(), z.number(), z.null()]),
          formula: z.string().optional(),
        }),
      ),
    }),
  ),
});
export type ProjectOverview = z.infer<typeof projectOverviewSchema>;
export type DrawingRegisterEntry = z.infer<typeof drawingRegisterEntrySchema>;
export type SheetPreview = z.infer<typeof sheetPreviewSchema>;
