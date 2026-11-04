import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { createApiClient, createResources } from "@/lib/api";
import { state, setMockRole } from "@/mocks/store";
const api = createResources(createApiClient("http://localhost/api/v1"));
function file(path: string) {
  return new File(
    [readFileSync(`public/mock-files/${path}`)],
    path.split("/").at(-1)!,
    {
      type: path.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf",
    },
  );
}
function versionForm(label: string, content: File) {
  const form = new FormData();
  form.set("label", label);
  form.set("file", content);
  return form;
}
afterEach(() => vi.useRealTimers());
test("a new revision supersedes current; duplicate and same-label uploads create conflicts", async () => {
  const form = new FormData();
  form.set("file", file("drawings/A-201-rev-A.pdf"));
  form.set("category", "drawing");
  form.set("docNumber", "TEST-201");
  form.set("title", "Test drawing");
  form.set("label", "A");
  const created = await api.uploadDocument("P-001", form);
  const original = created.currentVersionId!;
  const second = await api.uploadVersion(
    created.id,
    versionForm("B", file("drawings/A-201-rev-B.pdf")),
  );
  let versions = await api.versions(created.id);
  expect(versions.find((v) => v.id === original)?.status).toBe("superseded");
  expect(versions.filter((v) => v.status === "current")).toHaveLength(1);
  const duplicate = await api.uploadVersion(
    created.id,
    versionForm("B-copy", file("drawings/A-201-rev-B.pdf")),
  );
  expect(duplicate.status).toBe("conflict");
  expect((await api.conflicts(created.id))[0].kind).toBe("duplicate_file");
  expect((await api.document(created.id)).currentVersionId).toBe(second.id);
  await api.setCurrent(created.id, {
    versionId: second.id,
    reason: "Keep the verified current drawing.",
  });
  const same = await api.uploadVersion(
    created.id,
    versionForm("B", file("drawings/A-201-rev-C.pdf")),
  );
  expect(same.status).toBe("conflict");
  expect((await api.conflicts(created.id)).at(-1)?.kind).toBe(
    "same_label_different_file",
  );
  versions = await api.versions(created.id);
  expect(versions.filter((v) => v.status === "current")).toHaveLength(1);
  const blob = await api.documentFile(same.id);
  expect(blob.size).toBe(same.sizeBytes);
});
test("senior resolution requires a reason; viewer cannot upload or decide", async () => {
  const conflict = state.conflicts[0];
  await expect(
    api.setCurrent(conflict.documentId, {
      versionId: conflict.versionIds[1],
      reason: " ",
    }),
  ).rejects.toMatchObject({ status: 400 });
  setMockRole("viewer");
  await expect(
    api.setCurrent(conflict.documentId, {
      versionId: conflict.versionIds[1],
      reason: "Reviewed copy",
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    api.uploadVersion(
      "D-A201",
      versionForm("D", file("drawings/A-201-rev-A.pdf")),
    ),
  ).rejects.toMatchObject({ status: 403 });
  setMockRole("senior_qs");
  const doc = await api.setCurrent(conflict.documentId, {
    versionId: conflict.versionIds[1],
    reason: "Verified the correct issued copy.",
  });
  expect(doc.hasConflict).toBe(false);
  expect((await api.conflicts(doc.id))[0].resolution?.reason).toContain(
    "Verified",
  );
});
test("all read endpoints parse and cursor filters remain stable", async () => {
  await api.project("P-001");
  await api.overview("P-001");
  expect(
    await api.documents("P-001", { category: "contract", conflict: true }),
  ).toHaveLength(2);
  await api.drawings("P-001");
  await api.comparison("CMP-A201");
  expect(await api.changes("CMP-A201", { kind: "dimension" })).toHaveLength(1);
  await api.variations("P-001");
  await api.variation("VE-007");
  await api.links("P-001", { type: "variation", id: "VE-007" });
  await api.workbooks("P-001");
  await api.workbook("WB-001");
  await api.workbookVersion("WV-2");
  expect(await api.checks("WV-2", { rule: "amount_mismatch" })).toHaveLength(1);
  const page = await api.items("WV-2");
  expect(page.data).toHaveLength(100);
  const next = await api.items("WV-2", { cursor: page.nextCursor });
  expect(next.data[0].id).not.toBe(page.data[0].id);
  await api.sheet("WV-2", { sheet: "BOQ", fromRow: 30, toRow: 40 });
  expect((await api.diff("WB-001", "WV-1", "WV-2")).summary.added).toBe(3);
  expect((await api.downloadWorkbook("WV-2", true)).size).toBeGreaterThan(1000);
  await api.boqItems("P-001", "3.2.14");
  await api.materials({ category: "steel" });
  await api.forecast("rebar");
  await api.materialNeeds("P-001");
  await api.procurement("P-001");
  const audit = await api.auditEvents("P-001");
  expect(audit.nextCursor).toBeDefined();
  const filtered = await api.auditEvents("P-001", undefined, {
    entityType: "variation",
    entityId: "VE-007",
  });
  expect(
    filtered.data.every(
      (e) => e.entityType === "variation" && e.entityId === "VE-007",
    ),
  ).toBe(true);
});
test("actual workbook uploads run checks after five seconds and persist bytes", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const form = new FormData();
  form.set("file", file("workbooks/boq-v2.xlsx"));
  form.set("name", "Uploaded BOQ");
  form.set("kind", "boq");
  const workbook = await api.uploadWorkbook("P-001", form);
  const version = await api.workbookVersion(workbook.currentVersionId!);
  expect(version.status).toBe("parsing");
  setMockRole("viewer");
  await vi.advanceTimersByTimeAsync(5000);
  const checked = await api.workbookVersion(version.id);
  expect(checked.status).toBe("checked");
  expect(
    state.auditEvents.find(
      (e) => e.entityId === version.id && e.action === "workbook.checked",
    )?.actorRole,
  ).toBe("senior_qs");
  expect(
    await api.checks(version.id, { rule: "amount_mismatch" }),
  ).toHaveLength(1);
  expect((await api.downloadWorkbook(version.id)).size).toBe(version.sizeBytes);
});
test("comparison progresses to four new, human-reviewable changes in ten seconds", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const c = await api.runComparison("P-001", {
    documentId: "D-A201",
    baseVersionId: "D-A201-v2",
    targetVersionId: "D-A201-v3",
  });
  expect(c.status).toBe("queued");
  await vi.advanceTimersByTimeAsync(1500);
  expect((await api.comparison(c.id)).status).toBe("aligning");
  await vi.advanceTimersByTimeAsync(8500);
  expect((await api.comparison(c.id)).status).toBe("succeeded");
  const changes = await api.changes(c.id);
  expect(changes).toHaveLength(4);
  expect(changes.every((ch) => ch.status === "new")).toBe(true);
});

test("review, cost, decision and procurement mutations remain typed and audited", async () => {
  const change = await api.reviewChange("CH-S110-1", {
    status: "potential_variation",
    note: "Review the additional member.",
  });
  expect(change.review?.by).toBe("user-0");
  const aligned = await api.updateAlignment("CMP-S110", {
    dx: 2,
    dy: -1,
    scale: 1,
    rotationDeg: 0,
  });
  expect(aligned.alignment.method).toBe("manual");
  setMockRole("qs");
  const variation = await api.raiseVariation("P-001", {
    title: "Review additional steel",
    sourceChangeIds: [change.id],
    comparisonId: "CMP-S110",
  });
  const priced = await api.updateCostLines(variation.id, [
    {
      id: "line-test",
      boqItemRef: "3.2.14",
      description: "Rebar adjustment",
      unit: "tonne",
      quantityDelta: 1,
      rate: 7000,
      rateSource: "contract_boq",
      amount: 7000,
      materialId: "rebar",
    },
  ]);
  expect(priced.indicativeCost?.total).toBe(7000);
  expect(priced.indicativeCost?.basis).toContain("Synthetic demo range");
  expect(priced.indicativeCost!.low).toBeLessThan(7000);
  expect(priced.indicativeCost!.high).toBeGreaterThan(7000);
  await expect(
    api.decideVariation(variation.id, {
      status: "confirmed",
      reason: "Reviewed costs",
    }),
  ).rejects.toMatchObject({ status: 403 });
  const advice = await api.createProcurement("P-001", {
    materialId: "rebar",
    quantity: 4.2,
    neededBy: "2027-06-01",
    leadTimeWeeks: 8,
  });
  expect(advice.window).toEqual({ from: "2027-02", to: "2027-03" });
  setMockRole("senior_qs");
  expect(
    (
      await api.decideVariation(variation.id, {
        status: "confirmed",
        reason: "Verified quantities and current contract rates.",
      })
    ).status,
  ).toBe("confirmed");
  const events = await api.auditEvents("P-001", undefined, {
    entityType: "variation",
    entityId: variation.id,
  });
  expect(events.data.some((e) => e.action === "variation.confirmed")).toBe(
    true,
  );
});
test("mapping and check decisions update the current workbook without editing its bytes", async () => {
  const workbook = await api.workbook("WB-001");
  await api.updateMapping(workbook.id, workbook.mapping!);
  const check = (await api.checks("WV-2", { rule: "amount_mismatch" }))[0];
  await expect(
    api.resolveCheck(check.id, { status: "ignored" }),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    (
      await api.resolveCheck(check.id, {
        status: "ignored",
        reason: "Reviewed in the source workbook.",
      })
    ).resolution?.by,
  ).toBe("user-0");
  expect(
    (await api.checks("WV-2", { status: "ignored" })).map((c) => c.id),
  ).toContain(check.id);
  expect(
    (await api.resolveCheck(check.id, { status: "open" })).resolution,
  ).toBeUndefined();
});
test("workbook version uploads retain current on duplicate conflicts", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const wb = await api.workbook("WB-001");
  const form = new FormData();
  form.set("file", file("workbooks/boq-v2.xlsx"));
  const version = await api.uploadWorkbookVersion(wb.id, form);
  expect((await api.workbook(wb.id)).currentVersionId).toBe(
    wb.currentVersionId,
  );
  expect((await api.document(wb.documentId)).hasConflict).toBe(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect((await api.workbookVersion(version.id)).status).toBe("checked");
});

test("unsupported drawing bytes fail explicitly rather than inventing detected changes", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const c = await api.runComparison("P-001", {
    documentId: "D-A201",
    baseVersionId: "D-A201-v1",
    targetVersionId: "D-A201-v2",
  });
  await vi.advanceTimersByTimeAsync(10000);
  expect(await api.comparison(c.id)).toMatchObject({
    status: "failed",
    error: expect.stringContaining("No deterministic detection fixture"),
  });
  expect(await api.changes(c.id)).toHaveLength(0);
});
