import { projectHandlers } from "./projects";
import { flagHandlers } from "./flags";
import { documentHandlers } from "./documents";
import { jobReportHandlers } from "./jobs-reports";
import { wsHandlers } from "../ws";
export const handlers = [
  ...projectHandlers,
  ...flagHandlers,
  ...documentHandlers,
  ...jobReportHandlers,
  ...wsHandlers,
];
