import { z } from "zod";
export const rateGridRowSchema = z.object({
  boqItemRef: z.string(),
  description: z.string(),
  trade: z.string(),
  unit: z.string(),
  quantity: z.number().nonnegative(),
  benchmarkRate: z.number().optional(),
  benchmarkSufficient: z.boolean(),
  rates: z.record(
    z.string(),
    z.object({
      rate: z.number().nullable(),
      zScore: z.number().optional(),
      flagId: z.string().optional(),
    }),
  ),
});
export const rateGridPageSchema = z.object({
  rows: z.array(rateGridRowSchema),
  nextCursor: z.string().optional(),
  totalRows: z.number().int().nonnegative(),
});
export const priceDistributionSchema = z.object({
  benchmarkMeanHKD: z.number(),
  benchmarkSigmaHKD: z.number().positive(),
  points: z.array(
    z.object({
      tendererId: z.string(),
      totalValueHKD: z.number(),
      sigma: z.number(),
      withinTolerance: z.boolean(),
    }),
  ),
  thresholdSigma: z.number().positive(),
});
export type RateGridRow = z.infer<typeof rateGridRowSchema>;
export type RateGridPage = z.infer<typeof rateGridPageSchema>;
export type PriceDistribution = z.infer<typeof priceDistributionSchema>;
