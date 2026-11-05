import { createDocumentsHandlers } from "@/lib/domain/handlers/documents";
import { mockContext } from "../context";
import { adaptRoutes } from "./shared";
export const documentHandlers = adaptRoutes(
  createDocumentsHandlers(mockContext),
);
