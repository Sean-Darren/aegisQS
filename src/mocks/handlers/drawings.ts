import { createDrawingsHandlers } from "@/lib/domain/handlers/drawings";
import { mockContext } from "../context";
import { adaptRoutes } from "./shared";
export const drawingHandlers = adaptRoutes(createDrawingsHandlers(mockContext));
