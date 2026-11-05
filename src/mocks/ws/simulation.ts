import { createStartComparison } from "@/lib/domain/comparison";
import { mockContext } from "../context";
export function startComparison(
  ...args: Parameters<ReturnType<typeof createStartComparison>>
) {
  return createStartComparison(mockContext)(...args);
}
