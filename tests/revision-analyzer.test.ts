import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DomainContext } from "@/lib/domain/context";
import type { DocumentVersion, DrawingComparison } from "@/schemas";
import { runRevisionWorker } from "@/lib/backend/revision-analyzer";

function makeVersion(id: string, label: string): DocumentVersion {
  return {
    id,
    documentId: "D-1",
    label,
    fileName: `${id}.png`,
    mimeType: "image/png",
    sizeBytes: 4,
    sha256: id.padEnd(64, "0").slice(0, 64),
    status: "current",
    uploadedBy: "user-1",
    uploadedAt: "2026-11-06T00:00:00.000Z",
  };
}

function makeComparison(
  baseVersionId: string,
  targetVersionId: string,
): DrawingComparison {
  return {
    id: "CMP-1",
    projectId: "P-1",
    documentId: "D-1",
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
      quality: 1,
    },
    pageCount: 1,
    changeCounts: {
      added: 0,
      removed: 0,
      modified: 0,
      dimension: 0,
      annotation: 0,
    },
    modelVersion: "mock",
    createdAt: "2026-11-06T00:00:00.000Z",
  };
}

describe("runRevisionWorker", () => {
  const originalUrl = process.env.AEGISQS_BIM_WORKER_URL;

  beforeEach(() => {
    process.env.AEGISQS_BIM_WORKER_URL = "http://worker.test";
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AEGISQS_BIM_WORKER_URL;
    else process.env.AEGISQS_BIM_WORKER_URL = originalUrl;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("posts both revisions and maps the Hugging Face changes into cards", async () => {
    const base = makeVersion("DV-base", "A");
    const target = makeVersion("DV-target", "B");
    const comparison = makeComparison(base.id, target.id);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model_version: "aegisqs-hf-revision-1.0",
        base_materials: [{ material_code: "MAT-001" }],
        target_materials: [{ material_code: "MAT-007" }],
        changes: [
          {
            bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
            kind: "modified",
            summary: "Dark-brown roofing changed to Metal framing",
            confidence: 0.92,
            textBefore: "Dark-brown roofing",
            textAfter: "Metal framing",
          },
          {
            bbox: { x: 0.5, y: 0.5, w: 0.15, h: 0.1 },
            kind: "added",
            summary: "Clear glazing was added",
            confidence: 0.88,
            textBefore: null,
            textAfter: "Clear glazing",
          },
        ],
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({
          data: { data: { path: "stored/base-path" } },
          error: null,
        })),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn(async (path: string) => ({
            data: new Blob([`bytes:${path}`]),
            error: null,
          })),
        }),
      },
    } as unknown as Parameters<typeof runRevisionWorker>[0];

    const audit = vi.fn();
    const emit = vi.fn();
    const state: DomainContext["state"] = {
      projects: [],
      documents: [],
      versions: [base, target],
      conflicts: [],
      comparisons: [comparison],
      changes: [],
      variations: [],
      workbooks: [],
      workbookVersions: [],
      checks: [],
      items: [],
      materials: [],
      forecasts: [],
      procurement: [],
      materialNeeds: [],
      links: [],
      auditEvents: [],
      parsed: {},
      filePaths: {},
    };
    const ctx = {
      state,
      currentUser: () => ({
        id: "user-1",
        name: "User",
        email: "user@example.test",
        role: "admin",
        locale: "en",
      }),
      nextId: () => `CH-${Math.random()}`,
      now: () => "2026-11-06T01:00:00.000Z",
      audit,
      uploadedFiles: new Map(),
      emit,
      schedule: vi.fn(),
      startComparison: vi.fn(),
    } as unknown as DomainContext;

    await runRevisionWorker(db, ctx, comparison);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://worker.test/api/v1/bim/revision-comparisons",
      expect.objectContaining({ method: "POST" }),
    );
    expect(comparison.status).toBe("succeeded");
    expect(comparison.progressPct).toBe(100);
    expect(state.changes).toHaveLength(2);
    expect(state.changes[0].summary).toBe(
      "Dark-brown roofing changed to Metal framing",
    );
    expect(state.links).toHaveLength(4);
    expect(comparison.changeCounts.modified).toBe(1);
    expect(comparison.changeCounts.added).toBe(1);
    expect(audit).toHaveBeenCalledWith(
      "comparison.completed",
      "comparison",
      comparison.id,
      expect.stringContaining("2 changes"),
    );
    expect(emit).toHaveBeenCalledWith(
      comparison.projectId,
      expect.objectContaining({ status: "succeeded", changeCount: 2 }),
    );
  });
});
