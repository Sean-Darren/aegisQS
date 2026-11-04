import { z } from "zod";
import { isoDateSchema } from "./enums";
export const workbookKindSchema = z.enum([
  "boq",
  "cost_plan",
  "valuation",
  "other",
]);
const column = z.string().regex(/^[A-Z]{1,3}$/);
export const columnMappingSchema = z.object({
  sheet: z.string(),
  headerRow: z.number().int().positive(),
  columns: z.object({
    itemRef: column,
    description: column,
    unit: column,
    quantity: column,
    rate: column,
    amount: column,
    section: column.optional(),
  }),
});
export const workbookSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  documentId: z.string(),
  name: z.string(),
  kind: workbookKindSchema,
  currentVersionId: z.string().optional(),
  mapping: columnMappingSchema.optional(),
  updatedAt: isoDateSchema,
});
export const checkSummarySchema = z.object({
  errors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
});
export const workbookVersionSchema = z.object({
  id: z.string(),
  workbookId: z.string(),
  versionNumber: z.number().int().positive(),
  fileName: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  sheetNames: z.array(z.string()),
  status: z.enum(["parsing", "checking", "checked", "failed"]),
  checkSummary: checkSummarySchema.optional(),
  totals: z
    .array(z.object({ sheet: z.string(), amount: z.number() }))
    .optional(),
  uploadedBy: z.string(),
  uploadedAt: isoDateSchema,
});
export const checkRuleSchema = z.enum([
  "formula_error",
  "amount_mismatch",
  "sum_mismatch",
  "hardcoded_amount",
  "missing_rate",
  "missing_unit",
  "missing_quantity",
  "duplicate_item_ref",
  "rate_outlier",
  "external_link",
]);
export const workbookCheckSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  rule: checkRuleSchema,
  severity: z.enum(["error", "warning", "info"]),
  sheet: z.string(),
  cell: z.string().regex(/^[A-Z]+[1-9]\d*$/),
  itemRef: z.string().optional(),
  message: z.string(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  status: z.enum(["open", "resolved", "ignored"]),
  resolution: z
    .object({
      by: z.string(),
      at: isoDateSchema,
      reason: z.string().optional(),
    })
    .optional(),
});
export const boqItemSchema = z.object({
  id: z.string(),
  workbookVersionId: z.string(),
  sheet: z.string(),
  row: z.number().int().positive(),
  section: z.string().optional(),
  itemRef: z.string(),
  description: z.string(),
  unit: z.string(),
  quantity: z.number().nullable(),
  rate: z.number().nullable(),
  amount: z.number().nullable(),
  materialId: z.string().optional(),
});
const diffValue = z.union([z.string(), z.number(), z.null()]);
export const workbookDiffSchema = z.object({
  baseVersionId: z.string(),
  targetVersionId: z.string(),
  summary: z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    totalDelta: z.number(),
  }),
  rows: z.array(
    z.object({
      kind: z.enum(["added", "removed", "changed"]),
      sheet: z.string(),
      row: z.number().int().positive(),
      itemRef: z.string(),
      description: z.string(),
      fields: z.array(
        z.object({
          field: z.enum(["quantity", "rate", "amount", "description", "unit"]),
          before: diffValue,
          after: diffValue,
        }),
      ),
    }),
  ),
});
export type WorkbookKind = z.infer<typeof workbookKindSchema>;
export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type Workbook = z.infer<typeof workbookSchema>;
export type WorkbookVersion = z.infer<typeof workbookVersionSchema>;
export type CheckRule = z.infer<typeof checkRuleSchema>;
export type WorkbookCheck = z.infer<typeof workbookCheckSchema>;
export type BoqItem = z.infer<typeof boqItemSchema>;
export type WorkbookDiff = z.infer<typeof workbookDiffSchema>;
