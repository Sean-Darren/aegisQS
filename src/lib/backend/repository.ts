import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  snapshotSchema,
  type RecordRow,
  encodeState,
  diffRecords,
  projectFor,
} from "./records";
import { MockError } from "@/lib/domain/handlers/shared";
import type { DomainContext } from "@/lib/domain/context";
export const FILE_BUCKET = "smart-qs-files";
export async function loadSnapshot(db: SupabaseClient) {
  const { data, error } = await db.rpc("smart_qs_snapshot");
  if (error)
    throw new MockError(
      503,
      "Database is not ready. Apply the Supabase SQL migration and seed data.",
    );
  return snapshotSchema.parse(data);
}
export async function commitContext(
  db: SupabaseClient,
  ctx: DomainContext,
  before: RecordRow[],
  revision: number,
  events: RecordRow[],
) {
  const files: RecordRow[] = [];
  // Immutable object keys. Failed commits can leave unreferenced objects, never overwrite current files.
  for (const [id, bytes] of ctx.uploadedFiles) {
    const projectId =
      projectFor(ctx.state, "document_version", id) ??
      projectFor(ctx.state, "workbook_version", id);
    if (!projectId)
      throw new MockError(400, "File is not linked to a project.");
    const path = `${projectId}/${id}/${crypto.randomUUID()}`;
    const { error } = await db.storage
      .from(FILE_BUCKET)
      .upload(path, bytes, {
        upsert: false,
        contentType: "application/octet-stream",
      });
    if (error)
      throw new MockError(502, "File storage failed. Retry the upload.");
    files.push({ table: "file_objects", id, projectId, data: { path } });
  }
  const changes = [
    ...diffRecords(
      before.filter(
        (r) => !["project_events", "file_objects"].includes(r.table),
      ),
      encodeState(ctx.state),
    ),
    ...files,
    ...events,
  ];
  if (!changes.length) return;
  const { error } = await db.rpc("smart_qs_commit", {
    expected_revision: revision,
    changes,
  });
  if (error)
    throw new MockError(
      error.code === "40001" ? 409 : 500,
      error.code === "40001"
        ? "Another action changed these records. Reload and retry."
        : "The database could not save the action.",
    );
}
export async function hydrateFile(
  db: SupabaseClient,
  ctx: DomainContext,
  records: RecordRow[],
  id: string,
) {
  const row = records.find((r) => r.table === "file_objects" && r.id === id);
  if (!row)
    throw new MockError(
      404,
      "The file has not been migrated to private storage.",
    );
  const { path } = z.object({ path: z.string() }).parse(row.data);
  const { data, error } = await db.storage.from(FILE_BUCKET).download(path);
  if (error || !data)
    throw new MockError(502, "The stored file could not be downloaded.");
  ctx.uploadedFiles.set(id, await data.arrayBuffer());
}
