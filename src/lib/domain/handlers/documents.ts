import { projectFor } from "@/lib/backend/records";
import { z } from "zod";
import * as s from "@/schemas";
import type { DomainContext } from "../context";
import { createHelpers } from "./shared";
export function createDocumentsHandlers(ctx: DomainContext) {
  const { state, currentUser, now, nextId, audit, emit, startComparison } = ctx;
  const {
    route,
    reply,
    requireProject,
    requirePermission,
    document,
    find,
    fileInput,
    addVersion,
    bytesFor,
    fileReply,
    MockError,
  } = createHelpers(ctx);
  return [
    route("get", "/projects/:projectId/documents", ({ params, request }) => {
      const id = String(params.projectId);
      requireProject(id);
      const q = new URL(request.url).searchParams;
      return reply(
        z.array(s.hubDocumentSchema),
        state.documents.filter(
          (d) =>
            d.projectId === id &&
            (!q.get("category") || d.category === q.get("category")) &&
            (!q.get("discipline") || d.discipline === q.get("discipline")) &&
            (!q.get("conflict") ||
              d.hasConflict === (q.get("conflict") === "true")) &&
            `${d.docNumber} ${d.title}`
              .toLowerCase()
              .includes((q.get("q") ?? "").toLowerCase()),
        ),
      );
    }),
    route(
      "post",
      "/projects/:projectId/documents",
      async ({ params, request }) => {
        requirePermission("document.upload");
        const projectId = String(params.projectId);
        requireProject(projectId);
        const form = await request.formData();
        const input = s.hubDocumentSchema
          .pick({
            category: true,
            docNumber: true,
            title: true,
            discipline: true,
          })
          .extend({
            label: z.string().min(1),
            issuedDate: s.isoDateSchema.optional(),
          })
          .parse(Object.fromEntries(form));
        const file = await fileInput(form);
        let doc = state.documents.find(
          (d) => d.projectId === projectId && d.docNumber === input.docNumber,
        );
        const existing = doc;
        if (!doc) {
          doc = {
            id: nextId("D"),
            projectId,
            category: input.category,
            docNumber: input.docNumber,
            title: input.title,
            discipline: input.discipline,
            versionCount: 0,
            hasConflict: false,
            tags: [],
            updatedAt: now(),
          };
          state.documents.push(doc);
        }
        const base = doc.currentVersionId;
        const version = addVersion(doc, file, input.label, input.issuedDate);
        if (
          existing &&
          doc.category === "drawing" &&
          base &&
          version.status === "current"
        )
          startComparison(projectId, doc.id, base, version.id);
        return reply(s.hubDocumentSchema, doc, 201);
      },
    ),
    route("get", "/documents/:documentId", ({ params }) =>
      reply(s.hubDocumentSchema, document(String(params.documentId))),
    ),
    route("get", "/documents/:documentId/versions", ({ params }) => {
      const doc = document(String(params.documentId));
      return reply(
        z.array(s.documentVersionSchema),
        state.versions.filter((v) => v.documentId === doc.id).toReversed(),
      );
    }),
    route(
      "post",
      "/documents/:documentId/versions",
      async ({ params, request }) => {
        requirePermission("document.upload");
        const doc = document(String(params.documentId));
        const form = await request.formData();
        const input = z
          .object({
            label: z.string().min(1),
            issuedDate: s.isoDateSchema.optional(),
            notes: z.string().optional(),
          })
          .parse(Object.fromEntries(form));
        const file = await fileInput(form);
        const base = doc.currentVersionId;
        const version = addVersion(
          doc,
          file,
          input.label,
          input.issuedDate,
          input.notes,
        );
        if (doc.category === "drawing" && base && version.status === "current")
          startComparison(doc.projectId, doc.id, base, version.id);
        return reply(s.documentVersionSchema, version, 201);
      },
    ),
    route(
      "post",
      "/documents/:documentId/current",
      async ({ params, request }) => {
        requirePermission("document.setCurrent");
        const doc = document(String(params.documentId));
        const { versionId, reason } = z
          .object({ versionId: z.string(), reason: z.string().trim().min(1) })
          .parse(await request.json());
        const version = find(state.versions, versionId);
        if (version.documentId !== doc.id)
          throw new MockError(400, "The version belongs to another document.");
        for (const v of state.versions.filter((v) => v.documentId === doc.id))
          v.status = v.id === version.id ? "current" : "superseded";
        for (const conflict of state.conflicts.filter(
          (c) => c.documentId === doc.id && !c.resolution,
        ))
          conflict.resolution = {
            keptVersionId: versionId,
            by: currentUser().id,
            at: now(),
            reason,
          };
        doc.currentVersionId = versionId;
        doc.hasConflict = false;
        doc.updatedAt = now();
        const linked = state.links.find(
          (l) =>
            l.from.type === "workbook_version" &&
            l.to.type === "document_version" &&
            l.to.id === versionId,
        );
        if (linked) {
          const wv = find(state.workbookVersions, linked.from.id);
          find(state.workbooks, wv.workbookId).currentVersionId = wv.id;
        }
        audit(
          "document.current_set",
          "document",
          doc.id,
          `Rev ${version.label} set as current`,
          { reason },
        );
        emit(doc.projectId, {
          type: "document.version_added",
          documentId: doc.id,
          versionId,
          conflict: false,
        });
        return reply(s.hubDocumentSchema, doc);
      },
    ),
    route("get", "/documents/:documentId/conflicts", ({ params }) => {
      const doc = document(String(params.documentId));
      return reply(
        z.array(s.versionConflictSchema),
        state.conflicts.filter((c) => c.documentId === doc.id),
      );
    }),
    route("get", "/document-versions/:versionId/file", ({ params }) => {
      const version = find(state.versions, String(params.versionId));
      document(version.documentId);
      return fileReply(
        bytesFor(version.id),
        version.mimeType,
        version.fileName,
      );
    }),
    route("get", "/projects/:projectId/links", ({ params, request }) => {
      requireProject(String(params.projectId));
      const q = new URL(request.url).searchParams;
      return reply(
        z.array(s.entityLinkSchema),
        state.links.filter(
          (l) =>
            (projectFor(state, l.from.type, l.from.id) ===
              String(params.projectId) ||
              projectFor(state, l.to.type, l.to.id) ===
                String(params.projectId)) &&
            [l.from, l.to].some(
              (e) =>
                (!q.get("type") || e.type === q.get("type")) &&
                (!q.get("id") || e.id === q.get("id")),
            ),
        ),
      );
    }),
  ];
}
