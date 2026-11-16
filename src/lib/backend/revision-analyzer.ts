import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { DomainContext } from "@/lib/domain/context";
import type {
  DocumentVersion,
  DrawingChange,
  DrawingComparison,
} from "@/schemas";
import { FILE_BUCKET } from "./repository";

const bboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const revisionChangeSchema = z.object({
  bbox: bboxSchema,
  kind: z.enum(["added", "removed", "modified"]),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  textBefore: z.string().nullable().optional(),
  textAfter: z.string().nullable().optional(),
});

const revisionComparisonSchema = z.object({
  model_version: z.string(),
  base_materials: z.array(z.record(z.string(), z.unknown())),
  target_materials: z.array(z.record(z.string(), z.unknown())),
  changes: z.array(revisionChangeSchema),
});

function workerUrl() {
  return process.env.AEGISQS_BIM_WORKER_URL?.replace(/\/$/, "");
}

export function hasRevisionWorker() {
  return Boolean(workerUrl());
}

async function storedVersionBytes(
  db: SupabaseClient,
  versionId: string,
): Promise<ArrayBuffer> {
  const { data, error } = await db
    .from("file_objects")
    .select("data")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("The revision file is not available in project storage.");
  }

  const parsed = z.object({ path: z.string() }).parse(data.data ?? data);
  const { data: file, error: fileError } = await db.storage
    .from(FILE_BUCKET)
    .download(parsed.path);

  if (fileError || !file) {
    throw new Error("The revision file could not be downloaded.");
  }

  return file.arrayBuffer();
}

function fileForVersion(version: DocumentVersion, bytes: ArrayBuffer) {
  return new File([bytes], version.fileName || "revision.bin", {
    type: version.mimeType || "application/octet-stream",
  });
}

function toChange(
  comparison: DrawingComparison,
  payload: z.infer<typeof revisionChangeSchema>,
  index: number,
): DrawingChange {
  return {
    id: `CH-${crypto.randomUUID()}`,
    comparisonId: comparison.id,
    number: index + 1,
    page: 1,
    bbox: payload.bbox,
    kind: payload.kind,
    summary: payload.summary,
    textBefore: payload.textBefore ?? undefined,
    textAfter: payload.textAfter ?? undefined,
    confidence: payload.confidence,
    status: "new",
  };
}

export async function runRevisionWorker(
  db: SupabaseClient,
  ctx: DomainContext,
  comparison: DrawingComparison,
): Promise<void> {
  const { state, audit, emit, now } = ctx;
  const projectId = comparison.projectId;
  const base = state.versions.find((v) => v.id === comparison.baseVersionId);
  const target = state.versions.find(
    (v) => v.id === comparison.targetVersionId,
  );

  if (!base || !target) {
    throw new Error("One of the revision files is missing.");
  }

  comparison.pageCount = Math.max(
    base.pageCount ?? comparison.pageCount,
    target.pageCount ?? comparison.pageCount,
  );
  comparison.status = "detecting";
  comparison.progressPct = 80;
  comparison.modelVersion = "aegisqs-hf-revision-1.0";
  emit(projectId, {
    type: "comparison.progress",
    comparisonId: comparison.id,
    status: "detecting",
    progressPct: 80,
  });

  const [baseBytes, targetBytes] = await Promise.all([
    storedVersionBytes(db, base.id),
    storedVersionBytes(db, target.id),
  ]);

  const url = workerUrl();
  if (!url) {
    throw new Error("Hugging Face revision worker is not configured.");
  }

  const form = new FormData();
  form.set("base", fileForVersion(base, baseBytes));
  form.set("target", fileForVersion(target, targetBytes));

  // Server-to-server calls carry no browser Origin header, so the worker
  // authenticates them with a shared bearer token when one is configured.
  const workerToken = process.env.AEGISQS_BIM_WORKER_TOKEN?.trim();
  const response = await fetch(`${url}/api/v1/bim/revision-comparisons`, {
    method: "POST",
    body: form,
    headers: workerToken
      ? { Authorization: "Bearer " + workerToken }
      : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Revision worker returned ${response.status}: ${body.slice(0, 160)}`,
    );
  }

  const payload = revisionComparisonSchema.parse(await response.json());
  const changes = payload.changes.map((change, index) =>
    toChange(comparison, change, index),
  );

  state.changes = state.changes
    .filter((change) => change.comparisonId !== comparison.id)
    .concat(changes);

  comparison.status = "succeeded";
  comparison.progressPct = 100;
  comparison.finishedAt = now();
  comparison.changeCounts = {
    added: changes.filter((c) => c.kind === "added").length,
    removed: changes.filter((c) => c.kind === "removed").length,
    modified: changes.filter((c) => c.kind === "modified").length,
    dimension: changes.filter((c) => c.kind === "dimension").length,
    annotation: changes.filter((c) => c.kind === "annotation").length,
  };

  for (const change of changes) {
    state.links.push(
      {
        from: { type: "change", id: change.id },
        to: { type: "document_version", id: base.id },
      },
      {
        from: { type: "change", id: change.id },
        to: { type: "document_version", id: target.id },
      },
    );
  }

  audit(
    "comparison.completed",
    "comparison",
    comparison.id,
    `Hugging Face revision comparison ready — ${changes.length} changes found`,
  );
  emit(projectId, {
    type: "comparison.completed",
    comparisonId: comparison.id,
    status: "succeeded",
    changeCount: changes.length,
  });
}
