import { createWorkbooksHandlers } from "@/lib/domain/handlers/workbooks";
import { mockContext } from "../context";
import { adaptRoutes } from "./shared";
export const workbookHandlers = adaptRoutes(
  createWorkbooksHandlers(mockContext),
);
