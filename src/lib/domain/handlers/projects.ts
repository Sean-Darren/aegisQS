import { z } from "zod";
import * as s from "@/schemas";
import type { DomainContext } from "../context";
import { createHelpers, MockError } from "./shared";
export function createProjectsHandlers(ctx: DomainContext) {
  const { state, currentUser, now, nextId, audit } = ctx;
  const { route, reply, requirePermission, requireProject, paged } =
    createHelpers(ctx);
  const createProjectSchema = z.object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(20).optional(),
    location: z.string().trim().max(140).nullable().optional(),
    buildingType: s.buildingTypeSchema.nullable().optional(),
  });
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
    route("post", "/projects", async ({ request }) => {
      requirePermission("project.create");
      const body = createProjectSchema.parse(await request.json());
      const requestedCode = body.code?.toUpperCase();
      if (requestedCode) {
        const duplicate = state.projects.some(
          (p) => p.code.toUpperCase() === requestedCode,
        );
        if (duplicate)
          throw new MockError(409, "A project with this code already exists.");
      }
      const id = nextId("P");
      const code =
        requestedCode ??
        `P-${String(
          state.projects.filter((p) => /^P-\d+$/.test(p.code)).length + 1,
        ).padStart(3, "0")}`;
      const project = s.projectSchema.parse({
        id,
        code,
        name: body.name,
        location: body.location?.trim() || undefined,
        buildingType: body.buildingType ?? undefined,
        createdAt: now(),
        memberIds: [currentUser().id],
      });
      state.projects.push(project);
      audit(
        "project.created",
        "project",
        project.id,
        `Project ${project.code} created`,
        { code: project.code, name: project.name },
      );
      return reply(s.projectSchema, project, 201);
    }),
    route("patch", "/projects/:projectId", async ({ request, params }) => {
      requirePermission("project.update");
      const id = String(params.projectId);
      const project = requireProject(id);
      const body = createProjectSchema.partial().parse(await request.json());
      if (body.code) {
        const requestedCode = body.code.trim().toUpperCase();
        const duplicate = state.projects.some(
          (p) => p.code.toUpperCase() === requestedCode && p.id !== id,
        );
        if (duplicate)
          throw new MockError(409, "A project with this code already exists.");
      }
      const updated = s.projectSchema.parse({
        ...project,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.code !== undefined
          ? { code: body.code.trim().toUpperCase() }
          : {}),
        ...(body.location !== undefined
          ? { location: body.location?.trim() || undefined }
          : {}),
        ...(body.buildingType !== undefined
          ? { buildingType: body.buildingType ?? undefined }
          : {}),
      });
      state.projects = state.projects.map((p) => (p.id === id ? updated : p));
      audit(
        "project.updated",
        "project",
        updated.id,
        `Project ${updated.code} updated`,
        { code: updated.code, name: updated.name },
      );
      return reply(s.projectSchema, updated);
    }),
    route("delete", "/projects/:projectId", ({ params }) => {
      requirePermission("project.delete");
      const id = String(params.projectId);
      const project = requireProject(id);
      const documentIds = new Set(
        state.documents
          .filter((document) => document.projectId === id)
          .map((document) => document.id),
      );
      const documentVersionIds = new Set(
        state.versions
          .filter((version) => documentIds.has(version.documentId))
          .map((version) => version.id),
      );
      const workbookIds = new Set(
        state.workbooks
          .filter((workbook) => workbook.projectId === id)
          .map((workbook) => workbook.id),
      );
      const workbookVersionIds = new Set(
        state.workbookVersions
          .filter((version) => workbookIds.has(version.workbookId))
          .map((version) => version.id),
      );
      const comparisonIds = new Set(
        state.comparisons
          .filter((comparison) => comparison.projectId === id)
          .map((comparison) => comparison.id),
      );
      const changeIds = new Set(
        state.changes
          .filter((change) => comparisonIds.has(change.comparisonId))
          .map((change) => change.id),
      );
      const variationIds = new Set(
        state.variations
          .filter((variation) => variation.projectId === id)
          .map((variation) => variation.id),
      );
      const procurementIds = new Set(
        state.procurement
          .filter((advice) => advice.projectId === id)
          .map((advice) => advice.id),
      );
      const relatedEntityIds = new Set([
        id,
        ...documentIds,
        ...documentVersionIds,
        ...workbookIds,
        ...workbookVersionIds,
        ...comparisonIds,
        ...changeIds,
        ...variationIds,
        ...procurementIds,
      ]);
      const auditEventIds = new Set(
        state.auditEvents
          .filter((event) => belongsToProject(event, id))
          .map((event) => event.id),
      );

      state.projects = state.projects.filter((item) => item.id !== id);
      state.documents = state.documents.filter((item) => item.projectId !== id);
      state.versions = state.versions.filter(
        (item) => !documentVersionIds.has(item.id),
      );
      state.conflicts = state.conflicts.filter(
        (item) => !documentIds.has(item.documentId),
      );
      state.comparisons = state.comparisons.filter(
        (item) => item.projectId !== id,
      );
      state.changes = state.changes.filter((item) => !changeIds.has(item.id));
      state.variations = state.variations.filter(
        (item) => item.projectId !== id,
      );
      state.workbooks = state.workbooks.filter((item) => item.projectId !== id);
      state.workbookVersions = state.workbookVersions.filter(
        (item) => !workbookVersionIds.has(item.id),
      );
      state.checks = state.checks.filter(
        (item) => !workbookVersionIds.has(item.versionId),
      );
      state.items = state.items.filter(
        (item) => !workbookVersionIds.has(item.workbookVersionId),
      );
      state.procurement = state.procurement.filter(
        (item) => item.projectId !== id,
      );
      state.materialNeeds = state.materialNeeds.filter(
        (item) => item.projectId !== id,
      );
      state.links = state.links.filter(
        (link) =>
          !relatedEntityIds.has(link.from.id) &&
          !relatedEntityIds.has(link.to.id),
      );
      state.auditEvents = state.auditEvents.filter(
        (event) => !auditEventIds.has(event.id),
      );
      for (const versionId of documentVersionIds)
        delete state.filePaths[versionId];
      for (const versionId of workbookVersionIds)
        delete state.filePaths[versionId];
      for (const versionId of workbookVersionIds)
        delete state.parsed[versionId];

      return reply(s.projectSchema, project);
    }),
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
      const filtered = state.auditEvents
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
        .toSorted((a, b) => b.at.localeCompare(a.at));
      // Single-shot mode: a bounded slice with no cursor, so aggregate
      // callers (overview, entity activity) do not have to walk every
      // 3-row page of the log.
      const limitRaw = q.get("limit");
      if (limitRaw !== null) {
        const limit = Number(limitRaw);
        if (!Number.isInteger(limit) || limit < 1 || limit > 500)
          throw new MockError(400, "limit must be an integer from 1 to 500.");
        return Response.json(filtered.slice(0, limit));
      }
      return paged(filtered, q.get("cursor"), 3);
    }),
  ];
}
