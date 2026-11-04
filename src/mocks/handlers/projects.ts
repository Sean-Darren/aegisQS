import { z } from "zod";
import * as s from "@/schemas";
import { state, currentUser } from "../store";
import { route, reply, requireProject, paged } from "./shared";
export const projectHandlers = [
  route("get", "/me", () => reply(s.userSchema, currentUser())),
  route("get", "/projects", () =>
    reply(
      z.array(s.projectSchema),
      state.projects.filter((p) => p.memberIds.includes(currentUser().id)),
    ),
  ),
  route("get", "/projects/:projectId", ({ params }) =>
    reply(s.projectSchema, requireProject(String(params.projectId))),
  ),
  route("get", "/projects/:projectId/overview", ({ params }) => {
    const id = String(params.projectId);
    requireProject(id);
    const docs = state.documents.filter((d) => d.projectId === id);
    const wbIds = state.workbooks
      .filter((w) => w.projectId === id)
      .map((w) => w.id);
    const versions = state.workbookVersions
      .filter((v) => wbIds.includes(v.workbookId))
      .map((v) => v.id);
    return reply(s.projectOverviewSchema, {
      counts: {
        documents: docs.length,
        drawings: docs.filter((d) => d.category === "drawing").length,
        variations: state.variations.filter((v) => v.projectId === id).length,
        workbooks: wbIds.length,
        openChecks: state.checks.filter(
          (c) => versions.includes(c.versionId) && c.status === "open",
        ).length,
      },
      recentActivity: state.auditEvents
        .toSorted((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    });
  }),
  route("get", "/projects/:projectId/audit-events", ({ params, request }) => {
    requireProject(String(params.projectId));
    const q = new URL(request.url).searchParams;
    return paged(
      state.auditEvents
        .filter(
          (e) =>
            (!q.get("entityType") || e.entityType === q.get("entityType")) &&
            (!q.get("entityId") || e.entityId === q.get("entityId")) &&
            (!q.get("actorId") || e.actorId === q.get("actorId")) &&
            (!q.get("from") || e.at >= q.get("from")!) &&
            (!q.get("to") ||
              e.at <=
                (q.get("to")!.length === 10
                  ? `${q.get("to")}T23:59:59.999Z`
                  : q.get("to")!)),
        )
        .toSorted((a, b) => b.at.localeCompare(a.at)),
      q.get("cursor"),
      3,
    );
  }),
];
