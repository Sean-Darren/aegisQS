import { createVariationsHandlers } from "@/lib/domain/handlers/variations";
import { mockContext } from "../context";
import { adaptRoutes } from "./shared";
export const variationHandlers = adaptRoutes(
  createVariationsHandlers(mockContext),
);
