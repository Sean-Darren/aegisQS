import { z } from "zod";
import { isoDateSchema, periodSchema } from "./enums";
export const materialSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  unit: z.string(),
  category: z.enum([
    "steel",
    "concrete",
    "cement",
    "aggregate",
    "timber",
    "copper",
    "glass",
    "waterproofing",
    "other",
  ]),
  source: z.string(),
  latestPrice: z.number().nonnegative(),
  latestPeriod: periodSchema,
  change3mPct: z.number(),
  trend: z.enum(["rising", "stable", "falling"]),
});
export const priceForecastSchema = z.object({
  materialId: z.string(),
  history: z.array(
    z.object({ period: periodSchema, price: z.number().nonnegative() }),
  ),
  forecast: z.array(
    z
      .object({
        period: periodSchema,
        p50: z.number().nonnegative(),
        p10: z.number().nonnegative(),
        p90: z.number().nonnegative(),
        p025: z.number().nonnegative(),
        p975: z.number().nonnegative(),
      })
      .refine(
        (p) =>
          p.p025 <= p.p10 &&
          p.p10 <= p.p50 &&
          p.p50 <= p.p90 &&
          p.p90 <= p.p975,
        "Forecast bands must be ordered",
      ),
  ),
  model: z.object({
    name: z.string(),
    version: z.string(),
    trainedThrough: periodSchema,
    horizonMonths: z.number().int().positive(),
    backtestMapePct: z.number().nonnegative(),
    drivers: z.array(z.string()),
  }),
});
export const procurementAdviceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  materialId: z.string(),
  quantity: z.number().positive(),
  neededBy: isoDateSchema,
  leadTimeWeeks: z.number().nonnegative(),
  latestOrderDate: isoDateSchema,
  recommendation: z.enum(["buy_now", "buy_in_window", "no_clear_advantage"]),
  window: z.object({ from: periodSchema, to: periodSchema }).optional(),
  costIfBoughtNow: z.number().nonnegative(),
  expectedCostInWindow: z.number().nonnegative().optional(),
  expectedSaving: z.number().optional(),
  range: z
    .object({ low: z.number().nonnegative(), high: z.number().nonnegative() })
    .refine((r) => r.low <= r.high, "Range bounds must be ordered"),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.array(z.string()),
  createdBy: z.string(),
  createdAt: isoDateSchema,
});
export const projectMaterialNeedSchema = z.object({
  projectId: z.string(),
  materialId: z.string(),
  quantity: z.number(),
  neededBy: isoDateSchema.optional(),
  source: z.enum(["boq", "variation", "manual", "site_record"]),
  sourceRefs: z.array(z.string()),
  exposureHKD: z.object({ p10: z.number(), p50: z.number(), p90: z.number() }),
});
export type Material = z.infer<typeof materialSchema>;
export type PriceForecast = z.infer<typeof priceForecastSchema>;
export type ProcurementAdvice = z.infer<typeof procurementAdviceSchema>;
export type ProjectMaterialNeed = z.infer<typeof projectMaterialNeedSchema>;
