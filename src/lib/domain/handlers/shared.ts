import type { DomainContext } from "../context";
import { z } from "zod";
import { can, type Permission } from "@/lib/auth/permissions";
import type { DocumentVersion, HubDocument } from "@/schemas";
import drawingFiles from "@/mocks/fixtures/drawing-files.json";
import workbookFiles from "@/mocks/fixtures/workbook-files.json";
export class MockError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type DomainResolver = (info: {
  params: Record<string, string>;
  request: Request;
}) => Response | Promise<Response>;
export function route(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  resolver: DomainResolver,
) {
  return { method, path, resolver };
}
export type DomainRoute = ReturnType<typeof route>;
export function createHelpers(ctx: DomainContext) {
  const { state, currentUser, now, nextId, audit, uploadedFiles, emit } = ctx;
  function reply<S extends z.ZodType>(schema: S, data: unknown, status = 200) {
    const result = schema.safeParse(data);
    if (!result.success)
      throw new MockError(500, "Mock response did not match its schema.");
    return new Response(JSON.stringify(result.data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  function requirePermission(permission: Permission) {
    if (!can(currentUser(), permission))
      throw new MockError(403, "This role cannot perform that action.");
  }
  function requireProject(id: string) {
    requirePermission("project.view");
    const project = state.projects.find((p) => p.id === id);
    if (!project) throw new MockError(404, "Project not found.");
    if (!project.memberIds.includes(currentUser().id))
      throw new MockError(403, "Project access is required.");
    return project;
  }
  function find<T extends { id: string }>(items: T[], id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) throw new MockError(404, "Record not found.");
    return item;
  }
  function document(id: string) {
    const doc = find(state.documents, id);
    requireProject(doc.projectId);
    return doc;
  }
  function workbook(id: string) {
    const wb = find(state.workbooks, id);
    requireProject(wb.projectId);
    return wb;
  }
  function workbookVersion(id: string) {
    const version = find(state.workbookVersions, id);
    workbook(version.workbookId);
    return version;
  }
  function paged<T>(items: T[], cursor: string | null, size = 100) {
    let start = 0;
    if (cursor) {
      if (!/^cursor:\d+$/.test(cursor))
        throw new MockError(400, "Invalid cursor.");
      start = Number(cursor.slice(7));
    }
    return Response.json(items.slice(start, start + size), {
      headers:
        start + size < items.length
          ? { "X-Next-Cursor": `cursor:${start + size}` }
          : {},
    });
  }
  async function fileInput(form: FormData) {
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 50 * 1024 * 1024
    )
      throw new MockError(400, "Select a nonempty file up to 50 MB.");
    const bytes = await file.arrayBuffer();
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    return { file, bytes, sha256 };
  }
  function addVersion(
    doc: HubDocument,
    file: { file: File; bytes: ArrayBuffer; sha256: string },
    label: string,
    issuedDate?: string,
    notes?: string,
  ) {
    const previous = state.versions.filter((v) => v.documentId === doc.id);
    const duplicate = previous.find((v) => v.sha256 === file.sha256);
    const sameLabel = previous.find((v) => v.label === label);
    const current = previous.find((v) => v.id === doc.currentVersionId);
    const outOfOrder =
      current &&
      label.localeCompare(current.label, undefined, {
        numeric: true,
        sensitivity: "base",
      }) < 0;
    const conflictWith =
      duplicate ?? sameLabel ?? (outOfOrder ? current : undefined);
    if (doc.hasConflict && !conflictWith)
      throw new MockError(
        409,
        "Resolve the existing version conflict before setting a newer version as current.",
      );
    const known = Object.values(drawingFiles).find(
      (f) => f.sha256 === file.sha256,
    );
    const version: DocumentVersion = {
      id: nextId("DV"),
      documentId: doc.id,
      label,
      fileName: file.file.name,
      mimeType: mimeTypeForFile(file.file.name, file.file.type),
      sizeBytes: file.bytes.byteLength,
      sha256: file.sha256,
      status: conflictWith ? "conflict" : "current",
      ...(known ? { pageCount: known.pageCount } : {}),
      issuedDate,
      notes,
      uploadedBy: currentUser().role,
      uploadedAt: now(),
    };
    if (conflictWith) {
      state.conflicts.push({
        id: nextId("VC"),
        documentId: doc.id,
        kind: duplicate
          ? "duplicate_file"
          : sameLabel
            ? "same_label_different_file"
            : "out_of_order_label",
        versionIds: [conflictWith.id, version.id],
        detectedAt: now(),
      });
      doc.hasConflict = true;
    } else {
      for (const v of previous)
        if (v.status === "current") v.status = "superseded";
      doc.currentVersionId = version.id;
    }
    state.versions.push(version);
    uploadedFiles.set(version.id, file.bytes);
    doc.versionCount++;
    doc.updatedAt = now();
    audit(
      "document.version_uploaded",
      "document_version",
      version.id,
      `${doc.docNumber} Rev ${label} uploaded`,
      { documentId: doc.id, conflict: !!conflictWith },
    );
    emit(doc.projectId, {
      type: "document.version_added",
      documentId: doc.id,
      versionId: version.id,
      conflict: !!conflictWith,
    });
    return version;
  }

  function mimeTypeForFile(fileName: string, fallback: string) {
    const extension = fileName.toLowerCase().split(".").pop() ?? "";
    const known: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      pdf: "application/pdf",
      json: "application/json",
      ifc: "application/octet-stream",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
    };
    return known[extension] ?? fallback;
  }
  const knownFiles = Object.values({ ...drawingFiles, ...workbookFiles });
  function bytesFor(id: string): ArrayBuffer {
    const uploaded = uploadedFiles.get(id);
    if (uploaded) return uploaded;
    const path =
      state.filePaths[id] ??
      (id === "WV-1"
        ? workbookFiles["boq-v1"].path
        : id === "WV-2"
          ? workbookFiles["boq-v2"].path
          : undefined);
    const record = knownFiles.find((f) => f.path === path);
    if (!record) throw new MockError(404, "File not found.");
    return Uint8Array.from(atob(record.contentBase64), (c) => c.charCodeAt(0))
      .buffer;
  }
  function fileReply(bytes: ArrayBuffer, mimeType: string, name: string) {
    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  }

  return {
    route,
    reply,
    requirePermission,
    requireProject,
    find,
    document,
    workbook,
    workbookVersion,
    paged,
    fileInput,
    addVersion,
    bytesFor,
    fileReply,
    MockError,
  };
}
