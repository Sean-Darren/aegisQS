import { createMaterialsHandlers } from "@/lib/domain/handlers/materials";
import { mockContext } from "../context";
import { adaptRoutes } from "./shared";
export const materialHandlers = adaptRoutes(
  createMaterialsHandlers(mockContext),
);
