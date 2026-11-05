import { z } from "zod";
import * as s from "@/schemas";
import type { DomainContext } from "../context";
import { createHelpers } from "./shared";
export function createProjectsHandlers(ctx: DomainContext) {
  const { state, currentUser } = ctx;
  const { route, reply, requireProject, paged } = createHelpers(ctx);
  function belongsToProject(event: s.AuditEvent, projectId: string): boolean {
    const document = (id: string) =>
      state.documents.some((d) => d.id === id && d.projectId === projectId);
    const workbook = (id: string) =>
      state.workbooks.some((w) => w.id === id && w.projectId === projectId);
    const version = (id: string) => {
      const v = state.workbookVersions.find((v) => v.id === id);
      return !!v && workbook(v.workbookId);
    };
    switch (event.entityType) {
      case "project":
        return event.entityId === projectId;
      case "document":
        return document(event.entityId);
      case "document_version": {
        const v = state.versions.find((v) => v.id === event.entityId);
        return !!v && document(v.documentId);
      }
      case "comparison":
        return state.comparisons.some(
          (c) => c.id === event.entityId && c.projectId === projectId,
        );
      case "change": {
        const c = state.changes.find((c) => c.id === event.entityId);
        return (
          !!c &&
          state.comparisons.some(
            (v) => v.id === c.comparisonId && v.projectId === projectId,
          )
        );
      }
      case "variation":
        return state.variations.some(
          (v) => v.id === event.entityId && v.projectId === projectId,
        );
      case "workbook":
        return workbook(event.entityId);
      case "workbook_version":
        return version(event.entityId);
      case "check": {
        const c = state.checks.find((c) => c.id === event.entityId);
        return !!c && version(c.versionId);
      }
      case "procurement":
        return state.procurement.some(
          (a) => a.id === event.entityId && a.projectId === projectId,
        );
      case "user":
        return state.projects.some(
          (p) => p.id === projectId && p.memberIds.includes(event.entityId),
        );
    }
  }
  return [
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
          .filter((e) => belongsToProject(e, id))
          .toSorted((a, b) => b.at.localeCompare(a.at))
          .slice(0, 15),
      });
    }),
    route("get", "/projects/:projectId/audit-events", ({ params, request }) => {
      requireProject(String(params.projectId));
      const q = new URL(request.url).searchParams;
      return paged(
        state.auditEvents
          .filter(
            (e) =>
              belongsToProject(e, String(params.projectId)) &&
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
}
