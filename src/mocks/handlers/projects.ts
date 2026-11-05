import { createProjectsHandlers } from "@/lib/domain/handlers/projects";
import { mockContext } from "../context";
import { adaptRoutes } from "./shared";
export const projectHandlers = adaptRoutes(createProjectsHandlers(mockContext));
