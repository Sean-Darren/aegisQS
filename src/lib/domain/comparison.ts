import type { DrawingComparison, DrawingChange, DocumentVersion } from "@/schemas";
import regions from "@/mocks/fixtures/drawing-regions.json";
import files from "@/mocks/fixtures/drawing-files.json";
import type { DomainContext } from "./context";

type ChangeTemplate = {
  kind: DrawingChange["kind"];
  summary: string;
  confidence: number;
  bbox: DrawingChange["bbox"];
  textBefore?: string;
  textAfter?: string;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function knownDrawingBytes(version: DocumentVersion): ArrayBuffer | null {
  const record = Object.values(files).find(
    (file) => file.sha256 === version.sha256,
  );
  if (!record) return null;
  return Uint8Array.from(atob(record.contentBase64), (c) => c.charCodeAt(0))
    .buffer;
}

/** Fetch raw bytes for a document version from the API when not already cached. */
async function fetchFileBytes(version: DocumentVersion): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch(
      `${window.location.origin}/api/v1/document-versions/${encodeURIComponent(version.id)}/file`,
    );
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch {
    return null;
  }
}

type HfRevisionChange = {
  bbox: { x: number; y: number; w: number; h: number };
  kind: "added" | "removed" | "modified";
  summary: string;
  confidence: number;
  textBefore?: string | null;
  textAfter?: string | null;
};

type HfRevisionResponse = {
  model_version?: string;
  changes: HfRevisionChange[];
};

async function detectWithHuggingFace(
  ctx: DomainContext,
  base: DocumentVersion,
  target: DocumentVersion,
): Promise<ChangeTemplate[] | null> {
  if (typeof window === "undefined") return null;

  let baseBytes = ctx.uploadedFiles.get(base.id) ?? knownDrawingBytes(base);
  let targetBytes =
    ctx.uploadedFiles.get(target.id) ?? knownDrawingBytes(target);

  // Fallback: fetch from the API when bytes are not in the session cache
  // (e.g. the files were uploaded in a previous page load).
  if (!baseBytes) baseBytes = await fetchFileBytes(base);
  if (!targetBytes) targetBytes = await fetchFileBytes(target);

  if (!baseBytes || !targetBytes) return null;

  try {
    const payload = new FormData();
    payload.set(
      "base",
      new File([baseBytes], base.fileName, { type: base.mimeType }),
    );
    payload.set(
      "target",
      new File([targetBytes], target.fileName, { type: target.mimeType }),
    );
    const response = await fetch(
      `${window.location.origin}/api/v1/bim/revision-comparisons`,
      { method: "POST", body: payload },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as HfRevisionResponse;
    if (!json || !Array.isArray(json.changes)) return null;

    (ctx as unknown as Record<string, unknown>)._hfModelVersion =
      json.model_version ?? "aegisqs-hf-revision-unknown";

    return json.changes.map((change) => ({
      kind: change.kind,
      summary: change.summary,
      confidence: typeof change.confidence === "number" ? change.confidence : 0.65,
      bbox: {
        x: clampUnit(change.bbox.x),
        y: clampUnit(change.bbox.y),
        w: clampUnit(change.bbox.w),
        h: clampUnit(change.bbox.h),
      },
      textBefore: change.textBefore ?? undefined,
      textAfter: change.textAfter ?? undefined,
    }));
  } catch {
    return null;
  }
}

type RasterDiffRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
  kind: DrawingChange["kind"];
};

async function detectRasterChanges(
  ctx: DomainContext,
  base: DocumentVersion,
  target: DocumentVersion,
): Promise<ChangeTemplate[] | null> {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  )
    return null;
  if (!base.mimeType.startsWith("image/") || !target.mimeType.startsWith("image/"))
    return null;

  const baseBytes = ctx.uploadedFiles.get(base.id);
  const targetBytes = ctx.uploadedFiles.get(target.id);
  if (!baseBytes || !targetBytes) return null;

  try {
    const [baseBitmap, targetBitmap] = await Promise.all([
      createImageBitmap(new Blob([baseBytes])),
      createImageBitmap(new Blob([targetBytes])),
    ]);
    const maxSide = 512;
    const scale = Math.min(1, maxSide / Math.max(baseBitmap.width, targetBitmap.width));
    const width = Math.max(1, Math.round(Math.max(baseBitmap.width, targetBitmap.width) * scale));
    const height = Math.max(1, Math.round(Math.max(baseBitmap.height, targetBitmap.height) * scale));

    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = width;
    baseCanvas.height = height;
    const baseCtx = baseCanvas.getContext("2d", { willReadFrequently: true })!;
    baseCtx.drawImage(baseBitmap, 0, 0, width, height);
    const baseData = baseCtx.getImageData(0, 0, width, height).data;

    const targetCanvas = document.createElement("canvas");
    targetCanvas.width = width;
    targetCanvas.height = height;
    const targetCtx = targetCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;
    targetCtx.drawImage(targetBitmap, 0, 0, width, height);
    const targetData = targetCtx.getImageData(0, 0, width, height).data;

    const regions = rasterRegions(baseData, targetData, width, height);
    if (!regions.length) return [];

    return regions.map((region) => ({
      kind: region.kind,
      summary:
        region.kind === "added"
          ? "Visual content added in this area"
          : region.kind === "removed"
            ? "Visual content removed from this area"
            : "Visual content modified in this area",
      confidence: 0.55,
      bbox: {
        x: clampUnit(region.x),
        y: clampUnit(region.y),
        w: clampUnit(region.w),
        h: clampUnit(region.h),
      },
    }));
  } catch {
    return null;
  }
}

function rasterRegions(
  baseData: Uint8ClampedArray,
  targetData: Uint8ClampedArray,
  width: number,
  height: number,
): RasterDiffRegion[] {
  const mask = new Uint8Array(width * height);
  const luminance = new Float32Array(width * height);
  let changed = 0;

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const delta =
      Math.abs(baseData[offset] - targetData[offset]) +
      Math.abs(baseData[offset + 1] - targetData[offset + 1]) +
      Math.abs(baseData[offset + 2] - targetData[offset + 2]);
    luminance[i] =
      (targetData[offset] - baseData[offset]) * 0.299 +
      (targetData[offset + 1] - baseData[offset + 1]) * 0.587 +
      (targetData[offset + 2] - baseData[offset + 2]) * 0.114;
    if (delta > 36) {
      mask[i] = 1;
      changed += 1;
    }
  }

  if (changed < Math.max(32, width * height * 0.001)) return [];

  const visited = new Uint8Array(width * height);
  const regions: RasterDiffRegion[] = [];
  const queue = new Int32Array(width * height);

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    let lumaDelta = 0;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
      lumaDelta += luminance[index];

      if (x > 0 && mask[index - 1] && !visited[index - 1]) {
        visited[index - 1] = 1;
        queue[tail++] = index - 1;
      }
      if (x < width - 1 && mask[index + 1] && !visited[index + 1]) {
        visited[index + 1] = 1;
        queue[tail++] = index + 1;
      }
      if (y > 0 && mask[index - width] && !visited[index - width]) {
        visited[index - width] = 1;
        queue[tail++] = index - width;
      }
      if (y < height - 1 && mask[index + width] && !visited[index + width]) {
        visited[index + width] = 1;
        queue[tail++] = index + width;
      }
    }

    if (count < 24) continue;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    regions.push({
      x: minX / width,
      y: minY / height,
      w: w / width,
      h: h / height,
      count,
      kind:
        lumaDelta > count * 6
          ? "added"
          : lumaDelta < -count * 6
            ? "removed"
            : "modified",
    });
  }

  regions.sort((a, b) => b.count - a.count);
  return regions.slice(0, 8);
}

function resolveTemplates(
  ctx: DomainContext,
  base: DocumentVersion,
  target: DocumentVersion,
): ChangeTemplate[] | Promise<ChangeTemplate[]> {
  if (base.sha256 === target.sha256) return [];

  // The durable Node worker cannot call the browser HF proxy.  It keeps the
  // two seeded demo fixtures as a deterministic fallback and otherwise
  // returns no cards rather than inventing a generic revision description.
  if (typeof window === "undefined") {
    if (
      base.sha256 === files["A-201-B"].sha256 &&
      target.sha256 === files["A-201-C"].sha256
    )
      return regions.a201 as ChangeTemplate[];
    if (
      base.sha256 === files["S-110-P1"].sha256 &&
      target.sha256 === files["S-110-P2"].sha256
    )
      return regions.s110 as ChangeTemplate[];
    return [];
  }

  // Browser-side: HF proxy first, then fixtures, then client-side raster diff.
  return detectWithHuggingFace(ctx, base, target).then(async (hfChanges) => {
    if (hfChanges !== null) return hfChanges;

    if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
      if (
        base.sha256 === files["A-201-B"].sha256 &&
        target.sha256 === files["A-201-C"].sha256
      )
        return regions.a201 as ChangeTemplate[];
      if (
        base.sha256 === files["S-110-P1"].sha256 &&
        target.sha256 === files["S-110-P2"].sha256
      )
        return regions.s110 as ChangeTemplate[];
    }

    const rasterChanges = await detectRasterChanges(ctx, base, target);
    return rasterChanges ?? [];
  });
}

async function finishComparison(
  ctx: DomainContext,
  comparison: DrawingComparison,
) {
  const { state, audit, nextId, now, emit } = ctx;
  const actor = ctx.currentUser();
  const { projectId, baseVersionId, targetVersionId } = comparison;
  try {
    const base = state.versions.find((v) => v.id === baseVersionId)!;
    const target = state.versions.find((v) => v.id === targetVersionId)!;
    comparison.pageCount = Math.max(
      base.pageCount ?? comparison.pageCount,
      target.pageCount ?? comparison.pageCount,
    );
    const templateResult = resolveTemplates(ctx, base, target);
    const templates =
      templateResult instanceof Promise
        ? await templateResult
        : templateResult;

    const hfModelVersion = (ctx as unknown as Record<string, unknown>)
      ._hfModelVersion as string | undefined;
    if (hfModelVersion) comparison.modelVersion = hfModelVersion;

    if (!templates.length) {
      comparison.status = "succeeded";
      comparison.finishedAt = now();
      audit(
        "comparison.completed",
        "comparison",
        comparison.id,
        "Comparison ready — 0 changes found",
        undefined,
        actor,
      );
      emit(projectId, {
        type: "comparison.completed",
        comparisonId: comparison.id,
        status: "succeeded",
        changeCount: 0,
      });
      return;
    }

    for (const [i, template] of templates.entries()) {
      const change: DrawingChange = {
        ...template,
        kind: template.kind,
        id: nextId("CH"),
        comparisonId: comparison.id,
        number: i + 1,
        page: 1,
        confidence: template.confidence ?? 0.94,
        status: "new",
      };
      state.changes.push(change);
      comparison.changeCounts[change.kind]++;
      state.links.push(
        {
          from: { type: "change", id: change.id },
          to: { type: "document_version", id: baseVersionId },
        },
        {
          from: { type: "change", id: change.id },
          to: { type: "document_version", id: targetVersionId },
        },
      );
    }

    comparison.status = "succeeded";
    comparison.finishedAt = now();
    audit(
      "comparison.completed",
      "comparison",
      comparison.id,
      `Comparison ready — ${templates.length} changes found`,
      undefined,
      actor,
    );
    emit(projectId, {
      type: "comparison.completed",
      comparisonId: comparison.id,
      status: "succeeded",
      changeCount: templates.length,
    });
  } catch (error) {
    comparison.status = "failed";
    comparison.error =
      error instanceof Error ? error.message : "Comparison could not be completed.";
    comparison.finishedAt = now();
    audit(
      "comparison.failed",
      "comparison",
      comparison.id,
      comparison.error,
      undefined,
      actor,
    );
    emit(projectId, {
      type: "comparison.completed",
      comparisonId: comparison.id,
      status: "failed",
      changeCount: 0,
    });
  }
}

export function createStartComparison(ctx: DomainContext) {
  const { state, audit, nextId, now, emit } = ctx;
  return function startComparison(
    projectId: string,
    documentId: string,
    baseVersionId: string,
    targetVersionId: string,
  ) {
    const comparison: DrawingComparison = {
      id: nextId("CMP"),
      projectId,
      documentId,
      baseVersionId,
      targetVersionId,
      status: "queued",
      progressPct: 0,
      alignment: {
        dx: 0,
        dy: 0,
        scale: 1,
        rotationDeg: 0,
        method: "auto",
        quality: 0.96,
      },
      pageCount: 1,
      changeCounts: {
        added: 0,
        removed: 0,
        modified: 0,
        dimension: 0,
        annotation: 0,
      },
      modelVersion: "mock-drawing-1.0",
      createdAt: now(),
    };
    state.comparisons.push(comparison);
    audit(
      "comparison.started",
      "comparison",
      comparison.id,
      "Revision comparison queued",
    );
    emit(projectId, {
      type: "comparison.progress",
      comparisonId: comparison.id,
      status: "queued",
      progressPct: 0,
    });
    scheduleComparison(ctx, comparison);
    return comparison;
  };
}

export function scheduleComparison(
  ctx: DomainContext,
  comparison: DrawingComparison,
) {
  const { emit, schedule } = ctx;
  const { projectId } = comparison;
  for (const [ms, status, pct] of [
    [1500, "aligning", 20],
    [4500, "detecting", 60],
    [10000, "detecting", 90],
  ] as const)
    schedule(() => {
      comparison.status = status;
      comparison.progressPct = pct;
      if (ms === 10000) {
        void finishComparison(ctx, comparison);
      } else
        emit(projectId, {
          type: "comparison.progress",
          comparisonId: comparison.id,
          status,
          progressPct: pct,
        });
    }, ms);
}
