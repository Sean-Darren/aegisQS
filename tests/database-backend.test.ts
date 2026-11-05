import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { state } from "@/mocks/store";
import { users } from "@/mocks/fixtures/users";
import {
  encodeState,
  decodeState,
  diffRecords,
  type RecordRow,
} from "@/lib/backend/records";
import { createPersistentContext } from "@/lib/backend/context";
import { advanceJobs } from "@/lib/backend/jobs";
import type { Role } from "@/schemas";
const fake = vi.hoisted(() => ({
  role: "senior_qs" as Role,
  records: [] as RecordRow[],
  revision: 0,
  files: new Map<string, ArrayBuffer>(),
  writes: 0,
  loggedIn: true,
  failCommit: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: fake.loggedIn ? { id: "auth-user" } : null },
        error: null,
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { data: users.find((u) => u.role === fake.role) },
          }),
        }),
      }),
    }),
    rpc: async (
      name: string,
      args?: { expected_revision: number; changes: RecordRow[] },
    ) => {
      if (name === "smart_qs_snapshot")
        return {
          data: {
            revision: fake.revision,
            records: structuredClone(fake.records),
          },
          error: null,
        };
      if (fake.failCommit || args?.expected_revision !== fake.revision)
        return { error: { code: "40001" } };
      for (const row of args!.changes) {
        const at = fake.records.findIndex(
          (r) => r.table === row.table && r.id === row.id,
        );
        if (at >= 0) fake.records.splice(at, 1);
        if (!row.inactive) fake.records.push(row);
      }
      fake.revision++;
      fake.writes++;
      return { data: fake.revision, error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string, bytes: ArrayBuffer) => {
          fake.files.set(path, bytes);
          return { error: null };
        },
        download: async (path: string) => ({
          data: fake.files.has(path) ? new Blob([fake.files.get(path)!]) : null,
          error: null,
        }),
      }),
    },
  }),
}));
import { handleApi } from "@/lib/backend/api";
beforeEach(() => {
  fake.role = "senior_qs";
  fake.records = encodeState(structuredClone(state));
  fake.revision = 0;
  fake.files.clear();
  fake.writes = 0;
  fake.loggedIn = true;
  fake.failCommit = false;
});
afterEach(() => vi.unstubAllEnvs());
function request(path: string, method = "GET", body?: unknown) {
  return handleApi(
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: {
        Origin: "http://localhost",
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    }),
  );
}
test("JSONB order changes are not mutations and fixture state round-trips every feature", () => {
  const rows = encodeState(state);
  const canonical = JSON.parse(
    JSON.stringify(rows, (key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value,
    ),
  );
  expect(diffRecords(rows, canonical)).toEqual([]);
  expect(diffRecords(rows, encodeState(decodeState(rows)))).toEqual([]);
});
test("all feature read endpoints run through the authenticated database API", async () => {
  const endpoints = [
    "/me",
    "/projects",
    "/projects/P-001",
    "/projects/P-001/overview",
    "/projects/P-001/documents",
    "/projects/P-001/drawings",
    "/projects/P-001/variations",
    "/projects/P-001/workbooks",
    "/projects/P-001/material-needs",
    "/projects/P-001/procurement",
    "/projects/P-001/audit-events",
    "/projects/P-001/boq-items",
    "/materials",
    "/materials/rebar/forecast",
    "/workbooks/WB-001",
    "/workbook-versions/WV-2/checks",
    "/workbook-versions/WV-2/items",
    "/workbook-versions/WV-2/sheet",
    "/workbooks/WB-001/diff?base=WV-1&target=WV-2",
  ];
  for (const path of endpoints) {
    const response = await request(path);
    expect(response.status, path).toBe(200);
  }
  expect(fake.writes).toBe(0);
});
test("viewer, junior QS, unauthenticated and cross-origin mutations cannot bypass permissions", async () => {
  fake.role = "viewer";
  expect(
    (
      await request("/variations/VE-007/decision", "POST", {
        status: "confirmed",
        reason: "Reviewed",
      })
    ).status,
  ).toBe(403);
  fake.role = "qs";
  expect(
    (
      await request("/variations/VE-007/decision", "POST", {
        status: "confirmed",
        reason: "Reviewed",
      })
    ).status,
  ).toBe(403);
  const response = await handleApi(
    new Request("http://localhost/api/v1/projects", {
      method: "POST",
      headers: { Origin: "https://elsewhere.test" },
    }),
  );
  expect(response.status).toBe(403);
  fake.loggedIn = false;
  expect((await request("/projects")).status).toBe(401);
  expect(fake.writes).toBe(0);
});
test("senior decision persists with audit; a concurrent commit rolls back the response", async () => {
  expect(
    (
      await request("/variations/VE-007/decision", "POST", {
        status: "confirmed",
        reason: "Reviewed by lead QS",
      })
    ).status,
  ).toBe(200);
  expect(
    decodeState(fake.records).variations.find((v) => v.id === "VE-007")?.status,
  ).toBe("confirmed");
  expect(
    decodeState(fake.records).auditEvents.some(
      (e) => e.action === "variation.confirmed",
    ),
  ).toBe(true);
  fake.failCommit = true;
  expect(
    (
      await request("/variations/VE-007/decision", "POST", {
        status: "rejected",
        reason: "Another review",
      })
    ).status,
  ).toBe(409);
  expect(
    decodeState(fake.records).variations.find((v) => v.id === "VE-007")?.status,
  ).toBe("confirmed");
});
test("private document uploads survive a fresh backend context and preserve a single current revision", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File(["actual file bytes"], "notes.txt", { type: "text/plain" }),
  );
  form.set("category", "site_record");
  form.set("docNumber", "NEW-001");
  form.set("title", "Site note");
  form.set("label", "1");
  const response = await request("/projects/P-001/documents", "POST", form);
  expect(response.status).toBe(201);
  const doc = await response.json();
  const detail = await request(`/documents/${doc.id}/versions`);
  const versions = await detail.json();
  expect(
    versions.filter((v: { status: string }) => v.status === "current"),
  ).toHaveLength(1);
  const file = await request(`/document-versions/${versions[0].id}/file`);
  expect(await file.text()).toBe("actual file bytes");
});
test("real workbook upload stores parsing/checking state, then a restart-safe worker completes it", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [await readFile("public/mock-files/workbooks/boq-v2.xlsx")],
      "revised.xlsx",
    ),
  );
  form.set("name", "New BOQ");
  form.set("kind", "boq");
  const response = await request("/projects/P-001/workbooks", "POST", form);
  expect(response.status).toBe(201);
  const wb = await response.json();
  const persisted = decodeState(fake.records);
  const version = persisted.workbookVersions.find(
    (v) => v.workbookId === wb.id,
  )!;
  expect(version.status).toBe("parsing");
  const { ctx, events } = createPersistentContext(persisted, users[0]);
  advanceJobs(ctx, Date.parse(version.uploadedAt) + 6000);
  expect(version.status).toBe("checked");
  expect(version.checkSummary?.errors).toBeGreaterThan(0);
  expect(events.some((e) => e.table === "project_events")).toBe(true);
});

test("project membership is enforced even when the repository contains another project", async () => {
  const other = decodeState(fake.records);
  other.projects.push({
    id: "P-002",
    code: "PRIVATE",
    name: "Another project",
    createdAt: "2026-11-01T00:00:00Z",
    memberIds: ["another-user"],
  });
  fake.records = encodeState(other);
  expect((await request("/projects/P-002/documents")).status).toBe(403);
  expect(
    (
      await request("/projects/P-002/variations", "POST", {
        title: "Attempt",
        sourceChangeIds: ["x"],
        comparisonId: "x",
      })
    ).status,
  ).toBe(403);
  const listed = await (await request("/projects")).json();
  expect(listed.some((p: { id: string }) => p.id === "P-002")).toBe(false);
});

test("comparison worker resumes from persisted stages and does not invent a real detector", () => {
  const { ctx, events } = createPersistentContext(
    decodeState(fake.records),
    users[0],
  );
  const doc = ctx.state.documents.find((d) => d.docNumber === "A-201")!;
  const base = ctx.state.versions.find(
      (v) => v.documentId === doc.id && v.label === "B",
    )!,
    target = ctx.state.versions.find(
      (v) => v.documentId === doc.id && v.label === "C",
    )!;
  const comparison = ctx.startComparison(
    doc.projectId,
    doc.id,
    base.id,
    target.id,
  );
  advanceJobs(ctx, Date.parse(comparison.createdAt) + 2000, true);
  expect(comparison.status).toBe("aligning");
  const next = createPersistentContext(
    decodeState(encodeState(ctx.state)),
    users[0],
  );
  advanceJobs(next.ctx, Date.parse(comparison.createdAt) + 11000, true);
  expect(
    next.ctx.state.changes.filter((c) => c.comparisonId === comparison.id),
  ).toHaveLength(4);
  expect(
    next.ctx.state.comparisons.find((c) => c.id === comparison.id)?.status,
  ).toBe("succeeded");
  const unsupported = next.ctx.startComparison(
    doc.projectId,
    doc.id,
    base.id,
    target.id,
  );
  advanceJobs(next.ctx, Date.parse(unsupported.createdAt) + 11000, false);
  expect(unsupported.status).toBe("failed");
  expect(unsupported.error).toContain("not configured");
  expect(events.length).toBeGreaterThan(0);
});
