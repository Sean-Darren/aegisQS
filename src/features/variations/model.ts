import type { CostLine } from "@/schemas";
import { variationRangeRule } from "@/lib/config/variation";
export const moneyRound = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export function costAmount(quantity: number, rate: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(rate) || rate < 0)
    throw new RangeError("Enter a finite quantity and a nonnegative rate");
  return moneyRound(quantity * rate);
}
export function indicativeCost(lines: Pick<CostLine, "amount">[]) {
  const total = moneyRound(lines.reduce((sum, l) => sum + l.amount, 0));
  const bounds = [
    total * variationRangeRule.lowFactor,
    total * variationRangeRule.highFactor,
  ].sort((a, b) => a - b);
  return {
    total,
    low: moneyRound(bounds[0]),
    high: moneyRound(bounds[1]),
    basis: variationRangeRule.basis,
  };
}
