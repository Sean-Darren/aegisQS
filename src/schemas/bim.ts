import { z } from "zod";

export const bimJobStatusSchema = z.enum([
  "queued",
  "validating",
  "parsing",
  "readiness",
  "quantities",
  "boq",
  "pricing",
  "completed",
  "failed",
]);

export const bimIssueSchema = z
  .object({
    id: z.string(),
    element_id: z.string(),
    severity: z.string(),
    category: z.string(),
    message: z.string(),
    commercial_impact: z.string().optional(),
    material_family: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

export const bimMaterialMappingSchema = z
  .object({
    spec_id: z.string().optional(),
    spec_name: z.string().optional(),
    unit: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

export const bimReportSchema = z
  .object({
    overall_score: z.number().min(0).max(100),
    gate_state: z.string(),
    category_scores: z.record(z.string(), z.number()).optional(),
    issues: z.array(bimIssueSchema).optional(),
    material_mappings: z
      .record(z.string(), bimMaterialMappingSchema)
      .optional(),
    material_family_summary: z.record(z.string(), z.number()).optional(),
    summary: z.string().optional(),
    element_count: z.number().int().nonnegative().optional(),
    spec_count: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const bimBoqItemSchema = z
  .object({
    item_id: z.string(),
    description: z.string().optional(),
    quantity: z.union([z.number(), z.null()]).optional(),
    unit: z.string().optional(),
    rate: z.union([z.number(), z.null()]).optional(),
    total_price: z.number().optional(),
    rate_applied: z.number().optional(),
    price_book_item_code: z.union([z.string(), z.null()]).optional(),
    confidence: z.string().optional(),
    trade: z.string().optional(),
    material_family: z.string().optional(),
    material_code: z.string().optional(),
    bim_element: z.string().optional(),
    element_ids: z.array(z.string()).optional(),
  })
  .passthrough();

export const bimResultSchema = z
  .object({
    report: bimReportSchema,
    elements: z.array(z.unknown()).optional(),
    quantities: z.record(z.string(), z.unknown()).optional(),
    boq: z.array(bimBoqItemSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const bimJobCreatedSchema = z.object({
  job_id: z.string(),
  status: bimJobStatusSchema,
});

export const bimJobSnapshotSchema = z
  .object({
    job_id: z.string(),
    filename: z.string().optional(),
    status: bimJobStatusSchema,
    progress: z.number().min(0).max(100).optional(),
    message: z.string().optional(),
    error: z.union([z.string(), z.null()]).optional(),
    result: bimResultSchema.optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const bimProgressEventSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("bim.progress"),
        job_id: z.string(),
        status: bimJobStatusSchema,
        progress: z.number().min(0).max(100),
        message: z.string().optional(),
      })
      .passthrough(),
    z
      .object({
        type: z.literal("bim.completed"),
        job_id: z.string(),
        status: bimJobStatusSchema,
        progress: z.number().min(0).max(100),
        message: z.string().optional(),
      })
      .passthrough(),
    z
      .object({
        type: z.literal("bim.failed"),
        job_id: z.string(),
        status: bimJobStatusSchema,
        progress: z.number().min(0).max(100).optional(),
        message: z.string().optional(),
        error: z.union([z.string(), z.null()]).optional(),
      })
      .passthrough(),
  ]);

export type BimJobStatus = z.infer<typeof bimJobStatusSchema>;
export type BimIssue = z.infer<typeof bimIssueSchema>;
export type BimMaterialMapping = z.infer<typeof bimMaterialMappingSchema>;
export type BimReport = z.infer<typeof bimReportSchema>;
export type BimBoqItem = z.infer<typeof bimBoqItemSchema>;
export type BimResult = z.infer<typeof bimResultSchema>;
export type BimJobCreated = z.infer<typeof bimJobCreatedSchema>;
export type BimJobSnapshot = z.infer<typeof bimJobSnapshotSchema>;
export type BimProgressEvent = z.infer<typeof bimProgressEventSchema>;
