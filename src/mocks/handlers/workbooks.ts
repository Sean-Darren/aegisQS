import { z } from "zod";
import * as s from "@/schemas";
import {
  state,
  currentUser,
  nextId,
  now,
  audit,
  uploadedFiles,
} from "../store";
import {
  route,
  reply,
  requireProject,
  requirePermission,
  workbook,
  workbookVersion,
  document,
  find,
  fileInput,
  addVersion,
  paged,
  bytesFor,
  fileReply,
  MockError,
} from "./shared";
import {
  parseWorkbook,
  defaultMapping,
  summarizeChecks,
  diffWorkbooks,
  type ParsedWorkbook,
} from "../workbook-engine";
import { emit, schedule } from "../ws/events";
async function upload(wb: s.Workbook, form: FormData) {
  const actor = currentUser();
  const file = await fileInput(form);
  let parsed: ParsedWorkbook;
  const versionId = nextId("WV");
  try {
    parsed = await parseWorkbook(
      file.bytes,
      versionId,
      wb.mapping ?? defaultMapping,
    );
  } catch {
    throw new MockError(
      400,
      "This workbook could not be parsed. Upload a valid .xlsx file and check its sheet mapping.",
    );
  }
  const prior = state.workbookVersions.filter((v) => v.workbookId === wb.id);
  const number = prior.length
    ? Math.max(...prior.map((v) => v.versionNumber)) + 1
    : 1;
  const doc = document(wb.documentId);
  const dv = addVersion(doc, file, String(number));
  const version: s.WorkbookVersion = {
    id: versionId,
    workbookId: wb.id,
    versionNumber: number,
    fileName: file.file.name,
    sha256: file.sha256,
    sizeBytes: file.bytes.byteLength,
    sheetNames: parsed.sheetNames,
    status: "parsing",
    uploadedBy: currentUser().id,
    uploadedAt: now(),
  };
  state.workbookVersions.push(version);
  state.parsed[version.id] = parsed;
  state.items.push(...parsed.items);
  uploadedFiles.set(version.id, file.bytes);
  if (dv.status === "current") wb.currentVersionId = version.id;
  wb.updatedAt = now();
  state.links.push({
    from: { type: "workbook_version", id: version.id },
    to: { type: "document_version", id: dv.id },
  });
  for (const item of parsed.items)
    state.links.push({
      from: { type: "boq_item", id: item.id },
      to: { type: "workbook_version", id: version.id },
    });
  schedule(() => {
    version.status = "checking";
  }, 1000);
  schedule(() => {
    version.status = "checked";
    version.checkSummary = summarizeChecks(parsed.checks);
    version.totals = parsed.totals;
    state.checks.push(...parsed.checks);
    audit(
      "workbook.checked",
      "workbook_version",
      version.id,
      "Workbook checks completed",
      { checkSummary: version.checkSummary },
      actor,
    );
    emit(wb.projectId, {
      type: "workbook.checked",
      workbookId: wb.id,
      versionId: version.id,
      checkSummary: version.checkSummary,
    });
  }, 5000);
  return version;
}
export const workbookHandlers = [
  route("get", "/projects/:projectId/workbooks", ({ params }) => {
    const id = String(params.projectId);
    requireProject(id);
    return reply(
      z.array(s.workbookSchema),
      state.workbooks.filter((w) => w.projectId === id),
    );
  }),
  route(
    "post",
    "/projects/:projectId/workbooks",
    async ({ params, request }) => {
      requirePermission("workbook.upload");
      const projectId = String(params.projectId);
      requireProject(projectId);
      const form = await request.formData();
      const input = z
        .object({ name: z.string().min(1), kind: s.workbookKindSchema })
        .parse(Object.fromEntries(form));
      const doc: s.HubDocument = {
        id: nextId("D"),
        projectId,
        category: "financial",
        docNumber: nextId("XLS"),
        title: input.name,
        versionCount: 0,
        hasConflict: false,
        tags: [],
        updatedAt: now(),
      };
      const wb: s.Workbook = {
        id: nextId("WB"),
        projectId,
        documentId: doc.id,
        name: input.name,
        kind: input.kind,
        mapping: defaultMapping,
        updatedAt: now(),
      };
      state.documents.push(doc);
      state.workbooks.push(wb);
      try {
        await upload(wb, form);
      } catch (error) {
        state.documents = state.documents.filter((d) => d.id !== doc.id);
        state.workbooks = state.workbooks.filter((w) => w.id !== wb.id);
        throw error;
      }
      return reply(s.workbookSchema, wb, 201);
    },
  ),
  route("get", "/workbooks/:workbookId", ({ params }) =>
    reply(s.workbookSchema, workbook(String(params.workbookId))),
  ),
  route(
    "post",
    "/workbooks/:workbookId/versions",
    async ({ params, request }) => {
      requirePermission("workbook.upload");
      const wb = workbook(String(params.workbookId));
      return reply(
        s.workbookVersionSchema,
        await upload(wb, await request.formData()),
        201,
      );
    },
  ),
  route(
    "put",
    "/workbooks/:workbookId/mapping",
    async ({ params, request }) => {
      requirePermission("workbook.editMapping");
      const wb = workbook(String(params.workbookId));
      const { mapping } = z
        .object({ mapping: s.columnMappingSchema })
        .parse(await request.json());
      const current = state.workbookVersions.find(
        (v) => v.id === wb.currentVersionId,
      );
      let parsed: ParsedWorkbook | undefined;
      if (current)
        parsed = await parseWorkbook(bytesFor(current.id), current.id, mapping);
      wb.mapping = mapping;
      wb.updatedAt = now();
      if (parsed && current) {
        state.parsed[current.id] = parsed;
        state.items = state.items
          .filter((i) => i.workbookVersionId !== current.id)
          .concat(parsed.items);
        state.checks = state.checks
          .filter((c) => c.versionId !== current.id)
          .concat(parsed.checks);
        current.checkSummary = summarizeChecks(parsed.checks);
        current.totals = parsed.totals;
      }
      audit(
        "workbook.mapping_updated",
        "workbook",
        wb.id,
        "Workbook column mapping updated",
      );
      return reply(s.workbookSchema, wb);
    },
  ),
  route("get", "/workbook-versions/:versionId", ({ params }) =>
    reply(s.workbookVersionSchema, workbookVersion(String(params.versionId))),
  ),
  route(
    "get",
    "/workbook-versions/:versionId/checks",
    ({ params, request }) => {
      const version = workbookVersion(String(params.versionId));
      const q = new URL(request.url).searchParams;
      return reply(
        z.array(s.workbookCheckSchema),
        state.checks.filter(
          (c) =>
            c.versionId === version.id &&
            (!q.get("severity") || c.severity === q.get("severity")) &&
            (!q.get("rule") || c.rule === q.get("rule")) &&
            (!q.get("status") || c.status === q.get("status")),
        ),
      );
    },
  ),
  route("patch", "/checks/:checkId", async ({ params, request }) => {
    requirePermission("workbook.resolveCheck");
    const check = find(state.checks, String(params.checkId));
    workbookVersion(check.versionId);
    const body = z
      .object({
        status: s.workbookCheckSchema.shape.status,
        reason: z.string().trim().min(1).optional(),
      })
      .parse(await request.json());
    if (body.status === "ignored" && !body.reason)
      throw new MockError(400, "A reason is required when ignoring a check.");
    check.status = body.status;
    check.resolution =
      body.status === "open"
        ? undefined
        : { by: currentUser().id, at: now(), reason: body.reason };
    audit(
      `check.${body.status}`,
      "check",
      check.id,
      "Workbook check status updated",
      { reason: body.reason },
    );
    return reply(s.workbookCheckSchema, check);
  }),
  route("get", "/workbook-versions/:versionId/items", ({ params, request }) => {
    const version = workbookVersion(String(params.versionId));
    const q = new URL(request.url).searchParams;
    return paged(
      state.items.filter(
        (i) =>
          i.workbookVersionId === version.id &&
          (!q.get("section") || i.section === q.get("section")) &&
          `${i.itemRef} ${i.description}`
            .toLowerCase()
            .includes((q.get("q") ?? "").toLowerCase()),
      ),
      q.get("cursor"),
    );
  }),
  route("get", "/workbook-versions/:versionId/sheet", ({ params, request }) => {
    const version = workbookVersion(String(params.versionId));
    const q = new URL(request.url).searchParams;
    const sheet = q.get("sheet") ?? version.sheetNames[0];
    const fromRow = z.coerce
        .number()
        .int()
        .positive()
        .parse(q.get("fromRow") ?? 1),
      toRow = z.coerce
        .number()
        .int()
        .min(fromRow)
        .parse(q.get("toRow") ?? 50);
    const rows = state.parsed[version.id]?.sheets[sheet];
    if (!rows) throw new MockError(404, "Sheet not found.");
    return reply(s.sheetPreviewSchema, {
      sheet,
      fromRow,
      toRow,
      rows: rows.filter((r) => r.row >= fromRow && r.row <= toRow),
    });
  }),
  route("get", "/workbooks/:workbookId/diff", ({ params, request }) => {
    const wb = workbook(String(params.workbookId));
    const q = new URL(request.url).searchParams;
    const base = workbookVersion(q.get("base") ?? ""),
      target = workbookVersion(q.get("target") ?? "");
    if (base.workbookId !== wb.id || target.workbookId !== wb.id)
      throw new MockError(400, "Select two versions of this workbook.");
    return reply(
      s.workbookDiffSchema,
      diffWorkbooks(
        base.id,
        target.id,
        state.items.filter((i) => i.workbookVersionId === base.id),
        state.items.filter((i) => i.workbookVersionId === target.id),
      ),
    );
  }),
  route(
    "get",
    "/workbook-versions/:versionId/download",
    async ({ params, request }) => {
      const version = workbookVersion(String(params.versionId));
      let bytes = bytesFor(version.id);
      if (new URL(request.url).searchParams.get("annotated") === "true") {
        const { default: ExcelJS } = await import("exceljs");
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(bytes);
        for (const check of state.checks.filter(
          (c) => c.versionId === version.id,
        )) {
          const cell = book.getWorksheet(check.sheet)?.getCell(check.cell);
          if (cell) {
            cell.note = `${check.rule}: ${check.message}`;
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: check.severity === "error" ? "FFF7E0E2" : "FFF6EACB",
              },
            };
          }
        }
        bytes = new Uint8Array(await book.xlsx.writeBuffer()).buffer;
      }
      return fileReply(
        bytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version.fileName,
      );
    },
  ),
  route("get", "/projects/:projectId/boq-items", ({ params, request }) => {
    const id = String(params.projectId);
    requireProject(id);
    const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
    const current = state.workbooks
      .filter((w) => w.projectId === id && w.kind === "boq")
      .map((w) => w.currentVersionId);
    return reply(
      z.array(s.boqItemSchema),
      state.items.filter(
        (i) =>
          current.includes(i.workbookVersionId) &&
          `${i.itemRef} ${i.description}`.toLowerCase().includes(q),
      ),
    );
  }),
];
