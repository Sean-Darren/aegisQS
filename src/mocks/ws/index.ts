import { ws } from "msw";
import { can } from "@/lib/auth/permissions";
import { db, subscribe, registerCleanup, currentUser } from "../store";
import { wsEventSchema, type WsEvent } from "@/schemas";
const connection = ws.link(/wss?:\/\/[^/]+\/ws(?:\?.*)?$/);
export const wsHandlers = [
  connection.addEventListener("connection", ({ client }) => {
    const projectId = new URL(client.url).searchParams.get("projectId");
    if (
      !can(currentUser(), "project.view") ||
      !projectId ||
      !db.projects.some((project) => project.id === projectId)
    ) {
      client.close(1008, "Project access denied");
      return;
    }
    const send = (event: WsEvent) => {
      if (!can(currentUser(), "project.view")) {
        client.close(1008, "Project access denied");
        return;
      }
      client.send(JSON.stringify(wsEventSchema.parse(event)));
    };
    const unsubscribe = subscribe(projectId, send);
    const unregister = registerCleanup(() => {
      clearTimeout(snapshot);
      unsubscribe();
      client.close(1000, "Mock state reset");
    });
    client.addEventListener("close", () => {
      clearTimeout(snapshot);
      unsubscribe();
      unregister();
    });
    // A late subscriber receives the current state without restarting the job.
    const snapshot = setTimeout(() => {
      for (const job of db.jobs.filter(
        (job) =>
          job.projectId === projectId &&
          ["running", "queued"].includes(job.status),
      ))
        for (const progress of job.progress)
          send({ type: "job.progress", jobId: job.id, ...progress });
    }, 0);
  }),
];
