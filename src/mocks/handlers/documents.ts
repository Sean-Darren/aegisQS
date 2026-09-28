import { http } from "msw";
import { z } from "zod";
import { documentTypeSchema, projectDocumentSchema } from "@/schemas";
import {
  db,
  uploadedFiles,
  currentUser,
  nextId,
  now,
  audit,
  registerCleanup,
  signedDocumentIds,
} from "../store";
import { samplePdfBase64 } from "../fixtures/pdf";
import { json, projectGuard, allowed, failure } from "./shared";
export const documentHandlers = [
  http.get(
    "*/api/v1/projects/:projectId/documents",
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(
        z.array(projectDocumentSchema),
        db.documents.filter((doc) => doc.projectId === params.projectId),
      ),
  ),
  http.post(
    "*/api/v1/projects/:projectId/documents",
    async ({ params, request }) => {
      const projectId = String(params.projectId);
      const denied = projectGuard(projectId, "document.upload");
      if (denied) return denied;
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return failure(400, "INVALID_BODY", "Expected multipart form data.");
      }
      const file = form.get("file");
      const type = documentTypeSchema.safeParse(form.get("type"));
      const tendererId = form.get("tendererId");
      if (
        !(file instanceof File) ||
        !file.size ||
        !type.success ||
        (tendererId !== null && typeof tendererId !== "string")
      )
        return failure(
          400,
          "INVALID_BODY",
          "Provide a non-empty file and a valid document type.",
        );
      if (
        tendererId &&
        !db.tenderers.some(
          (t) => t.projectId === projectId && t.id === tendererId,
        )
      )
        return failure(
          400,
          "INVALID_TENDERER",
          "Tenderer does not belong to this project.",
        );
      if (type.data === "priced_boq" && !tendererId)
        return failure(
          400,
          "TENDERER_REQUIRED",
          "Select a tenderer for the priced BOQ.",
        );
      const doc = projectDocumentSchema.parse({
        id: nextId("D"),
        projectId,
        ...(tendererId ? { tendererId } : {}),
        type: type.data,
        fileName: file.name,
        version:
          1 +
          db.documents
            .filter(
              (d) =>
                d.projectId === projectId &&
                d.tendererId === (tendererId || undefined) &&
                d.type === type.data &&
                d.fileName === file.name,
            )
            .reduce((max, d) => Math.max(max, d.version), 0),
        parseStatus: "queued",
        uploadedBy: currentUser().id,
        uploadedAt: now(),
      });
      db.documents.push(doc);
      uploadedFiles.set(doc.id, file);
      audit("document.uploaded", "document", doc.id);
      const timer = setTimeout(() => {
        doc.parseStatus = "parsed";
        unregister();
      }, 1000);
      const unregister = registerCleanup(() => clearTimeout(timer));
      return json(projectDocumentSchema, doc, 201);
    },
  ),
  http.post("*/api/v1/documents/:documentId/reprocess", ({ params }) => {
    const doc = db.documents.find((item) => item.id === params.documentId);
    if (!doc) return failure(404, "NOT_FOUND", "Document not found.");
    const denied = projectGuard(doc.projectId, "document.upload");
    if (denied) return denied;
    if (doc.parseStatus !== "failed")
      return failure(
        409,
        "NOT_FAILED",
        "Only failed document parsing can be retried.",
      );
    doc.parseStatus = "queued";
    delete doc.parseError;
    audit("document.reprocessing", "document", doc.id);
    const timer = setTimeout(() => {
      doc.parseStatus = "parsed";
      unregister();
    }, 1000);
    const unregister = registerCleanup(() => clearTimeout(timer));
    return json(projectDocumentSchema, doc, 202);
  }),
  http.get("*/api/v1/documents/:documentId/file", ({ params }) => {
    const doc = db.documents.find((d) => d.id === params.documentId);
    if (!doc) return failure(404, "NOT_FOUND", "Document not found.");
    const denied = allowed("project.view");
    if (
      denied &&
      (allowed("report.viewSigned") || !signedDocumentIds.has(doc.id))
    )
      return denied;
    const body =
      uploadedFiles.get(doc.id) ??
      new Blob(
        [Uint8Array.from(atob(samplePdfBase64), (char) => char.charCodeAt(0))],
        { type: "application/pdf" },
      );
    return new Response(body, {
      headers: {
        "Content-Type": body.type || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      },
    });
  }),
];
