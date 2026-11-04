import { z } from "zod";
import { isoDateSchema } from "./enums";
export const variationStatusSchema = z.enum([
  "potential",
  "under_review",
  "confirmed",
  "rejected",
]);
export const costLineSchema = z
  .object({
    id: z.string(),
    boqItemRef: z.string(),
    description: z.string(),
    unit: z.string(),
    quantityDelta: z.number(),
    rate: z.number().nonnegative(),
    rateSource: z.enum(["contract_boq", "forecast_adjusted", "manual"]),
    amount: z.number(),
    materialId: z.string().optional(),
  })
  .refine(
    (l) => Math.abs(l.amount - l.quantityDelta * l.rate) < 0.011,
    "Amount must equal quantity delta times rate",
  );
export const variationEventSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  ref: z.string(),
  title: z.string(),
  drawingNumber: z.string(),
  sourceChangeIds: z.array(z.string()),
  comparisonId: z.string(),
  status: variationStatusSchema,
  costLines: z.array(costLineSchema),
  indicativeCost: z
    .object({
      total: z.number(),
      low: z.number(),
      high: z.number(),
      basis: z.string(),
    })
    .refine(
      (c) => c.low <= c.total && c.total <= c.high,
      "Range must include the total",
    )
    .optional(),
  raisedBy: z.string(),
  raisedAt: isoDateSchema,
  decision: z
    .object({
      status: z.enum(["confirmed", "rejected"]),
      by: z.string(),
      at: isoDateSchema,
      reason: z.string().min(1),
    })
    .optional(),
});
export type VariationStatus = z.infer<typeof variationStatusSchema>;
export type CostLine = z.infer<typeof costLineSchema>;
export type VariationEvent = z.infer<typeof variationEventSchema>;
