import { ws } from "msw";
import { listen } from "./events";
import { state } from "../store";
const projectSocket = ws.link(/\/ws$/);
export const wsHandlers = [
  projectSocket.addEventListener("connection", ({ client }) => {
    const projectId = new URL(client.url).searchParams.get("projectId");
    if (!state.projects.some((p) => p.id === projectId)) {
      client.close(1008, "Unknown project");
      return;
    }
    const unsubscribe = listen((id, event) => {
      if (id === projectId) client.send(JSON.stringify(event));
    });
    client.addEventListener("close", unsubscribe);
    for (const comparison of state.comparisons.filter(
      (c) => c.projectId === projectId,
    ))
      client.send(
        JSON.stringify({
          type: "comparison.progress",
          comparisonId: comparison.id,
          status: comparison.status,
          progressPct: comparison.progressPct,
        }),
      );
    for (const workbook of state.workbooks.filter(
      (w) => w.projectId === projectId,
    )) {
      const version = state.workbookVersions.find(
        (v) => v.id === workbook.currentVersionId,
      );
      if (version?.status === "checked")
        client.send(
          JSON.stringify({
            type: "workbook.checked",
            workbookId: workbook.id,
            versionId: version.id,
            checkSummary: version.checkSummary,
          }),
        );
    }
  }),
];
