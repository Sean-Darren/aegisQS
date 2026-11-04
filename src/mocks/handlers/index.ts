import { projectHandlers } from "./projects";
import { documentHandlers } from "./documents";
import { drawingHandlers } from "./drawings";
import { variationHandlers } from "./variations";
import { workbookHandlers } from "./workbooks";
import { materialHandlers } from "./materials";
import { wsHandlers } from "../ws";
export const handlers = [
  ...projectHandlers,
  ...documentHandlers,
  ...drawingHandlers,
  ...variationHandlers,
  ...workbookHandlers,
  ...materialHandlers,
  ...wsHandlers,
];
