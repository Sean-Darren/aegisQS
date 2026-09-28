import { z } from "zod";
import {
  auditorKindSchema,
  signalKeySchema,
  severitySchema,
  flagStatusSchema,
  isoDateTimeSchema,
} from "./enums";
export const evidenceSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  page: z.number().int().positive().optional(),
  boqItemRef: z.string().optional(),
  bbox: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      w: z.number().positive().max(1),
      h: z.number().positive().max(1),
    })
    .refine(
      (b) => b.x + b.w <= 1.0000001 && b.y + b.h <= 1.0000001,
      "Bounding box must fit the page",
    )
    .optional(),
  excerpt: z.string().min(1),
  calculation: z
    .object({
      expression: z.string(),
      inputs: z.record(z.string(), z.number()),
      result: z.number(),
    })
    .optional(),
});
export const dispositionInputSchema = z.object({
  action: z.enum(["accept", "dismiss", "escalate"]),
  reason: z.string().trim().min(10),
});
export const flagDecisionSchema = dispositionInputSchema.extend({
  by: z.string(),
  at: isoDateTimeSchema,
});
export const flagSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tendererId: z.string().optional(),
  auditor: auditorKindSchema,
  signal: signalKeySchema,
  severity: severitySchema,
  confidence: z.number().min(0).max(1),
  title: z.string(),
  description: z.string(),
  boqItemRef: z.string().optional(),
  zScore: z.number().optional(),
  threshold: z
    .object({ kind: z.enum(["sigma", "percent"]), value: z.number() })
    .optional(),
  evidence: z.array(evidenceSchema).min(1),
  status: flagStatusSchema,
  proposal: flagDecisionSchema.optional(),
  decision: flagDecisionSchema.optional(),
  assigneeId: z.string().optional(),
  createdAt: isoDateTimeSchema,
});
export const flagFiltersSchema = z.object({
  severity: severitySchema.optional(),
  status: flagStatusSchema.optional(),
  tendererId: z.string().optional(),
  auditor: auditorKindSchema.optional(),
  signal: signalKeySchema.optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export type FlagDecision = z.infer<typeof flagDecisionSchema>;
export type Flag = z.infer<typeof flagSchema>;
export type FlagFilters = z.infer<typeof flagFiltersSchema>;
export type DispositionInput = z.infer<typeof dispositionInputSchema>;
