import { expect, test, vi } from "vitest";
import { createApiClient, createResources } from "@/lib/api";
import { db, setMockRole } from "@/mocks/store";
import type { FlagFilters } from "@/schemas";
const api = createResources(createApiClient("http://localhost/api/v1"));
const pid = "P-001";
test("every read endpoint returns its parsed contract", async () => {
  const [
    projects,
    project,
    documents,
    tenderers,
    bids,
    kpis,
    scores,
    distribution,
    gaps,
    reports,
    job,
    flag,
  ] = await Promise.all([
    api.projects(),
    api.project(pid),
    api.documents(pid),
    api.tenderers(pid),
    api.bids(pid),
    api.kpis(pid),
    api.scores(pid),
    api.priceDistribution(pid),
    api.scopeGaps(pid),
    api.reports(pid),
    api.job("J-001"),
    api.flag("F-001"),
  ]);
  expect(projects).toHaveLength(1);
  expect(project.id).toBe(pid);
  expect(documents).toHaveLength(13);
  expect(
    documents.filter((document) => document.type === "inspection_report"),
  ).toHaveLength(1);
  expect(tenderers).toHaveLength(12);
  expect(bids).toHaveLength(12);
  expect(kpis.avgRateVarianceZ).toBe(0.42);
  expect(scores[0].score).toBe(94.2);
  expect(distribution.points).toHaveLength(12);
  expect(gaps).toHaveLength(4);
  expect(reports[0].status).toBe("draft");
  expect(job.progress).toHaveLength(48);
  expect(flag.id).toBe("F-001");
});
const filters: FlagFilters[] = [
  { severity: "critical" },
  { status: "proposed" },
  { tendererId: "T-002" },
  { auditor: "rate_variation" },
  { signal: "scope_ambiguity" },
  {
    severity: "critical",
    status: "open",
    tendererId: "T-001",
    auditor: "scope_completeness",
    signal: "rate_anomalies",
  },
];
test.each(filters)("flag filters apply conjunctively: %j", async (filters) => {
  const found = await api.flags(pid, filters);
  expect(found.length).toBeGreaterThan(0);
  for (const flag of found)
    for (const [key, value] of Object.entries(filters))
      expect(flag[key as keyof FlagFilters]).toBe(value);
  expect(found).toEqual(
    db.flags.filter((flag) =>
      Object.entries(filters).every(
        ([key, value]) => flag[key as keyof FlagFilters] === value,
      ),
    ),
  );
});
test("invalid filters fail and valid filters with no matches return an empty list", async () => {
  const response = await fetch(
    "http://localhost/api/v1/projects/P-001/flags?severity=urgent",
  );
  expect(response.status).toBe(400);
  expect(await api.flags(pid, { tendererId: "nonexistent" })).toEqual([]);
});
test("rate-grid pages cover all 3000 rows once; filtered totals and cursors are stable", async () => {
  const refs: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.rateGrid(pid, { cursor });
    expect(page.totalRows).toBe(3000);
    refs.push(...page.rows.map((row) => row.boqItemRef));
    cursor = page.nextCursor;
  } while (cursor);
  expect(refs).toHaveLength(3000);
  expect(new Set(refs).size).toBe(3000);
  const flagged = await api.rateGrid(pid, { flaggedOnly: true });
  expect(flagged.totalRows).toBe(150);
  expect(
    flagged.rows.every((row) =>
      Object.values(row.rates).some((rate) => rate.flagId),
    ),
  ).toBe(true);
  const trade = await api.rateGrid(pid, { trade: "waterproofing" });
  expect(trade.totalRows).toBe(375);
  expect(trade.rows.every((row) => row.trade === "waterproofing")).toBe(true);
  await expect(
    api.rateGrid(pid, { cursor: trade.nextCursor, trade: "windows" }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(api.rateGrid(pid, { cursor: "invalid" })).rejects.toMatchObject({
    status: 400,
  });
});
test("audit pagination exposes the next cursor without changing the array contract", async () => {
  const first = await api.auditEvents(pid);
  expect(first.data).toHaveLength(100);
  expect(first.nextCursor).toBeDefined();
  const last = await api.auditEvents(pid, first.nextCursor);
  expect(last.data).toHaveLength(25);
  expect(last.nextCursor).toBeUndefined();
  expect(
    new Set([...first.data, ...last.data].map((event) => event.id)).size,
  ).toBe(125);
  await expect(api.auditEvents(pid, "bad")).rejects.toMatchObject({
    status: 400,
  });
});
test("uploads persist bytes and metadata, simulate parsing, and reject invalid tenderers", async () => {
  const file = new File(["%PDF-test-upload"], "upload.pdf", {
    type: "application/pdf",
  });
  const doc = await api.uploadDocument(pid, file, "priced_boq", "T-001");
  expect(doc.parseStatus).toBe("queued");
  expect((await api.documents(pid)).some((item) => item.id === doc.id)).toBe(
    true,
  );
  expect(await (await api.documentFile(doc.id)).text()).toBe(
    "%PDF-test-upload",
  );
  const next = await api.uploadDocument(pid, file, "priced_boq", "T-001");
  expect(next.version).toBe(2);
  await vi.waitFor(
    () =>
      expect(db.documents.find((item) => item.id === doc.id)?.parseStatus).toBe(
        "parsed",
      ),
    { timeout: 2000 },
  );
  await expect(
    api.uploadDocument(pid, file, "priced_boq", "bad"),
  ).rejects.toMatchObject({ status: 400 });
  expect((await api.documentFile("D-001")).type).toBe("application/pdf");
});
test("junior proposals persist; only senior QS finalizes; reasons are required", async () => {
  setMockRole("junior_qs");
  const proposal = await api.propose("F-001", {
    action: "escalate",
    reason: "Please review the cited rate.",
  });
  expect(proposal).toMatchObject({
    status: "proposed",
    proposal: { by: "user-junior" },
  });
  await expect(
    api.decide("F-001", {
      action: "accept",
      reason: "The evidence supports the flag.",
    }),
  ).rejects.toMatchObject({ status: 403 });
  setMockRole("senior_qs");
  await expect(
    api.decide("F-001", { action: "accept", reason: "short" }),
  ).rejects.toMatchObject({ status: 400 });
  const finalized = await api.decide("F-001", {
    action: "accept",
    reason: "The evidence supports the flag.",
  });
  expect(finalized).toMatchObject({
    status: "accepted",
    decision: { by: "user-senior" },
  });
  expect((await api.flag("F-001")).decision).toEqual(finalized.decision);
});
test("sign-off enforces permission, blocking flags, override reasons and immutable signed versions", async () => {
  setMockRole("junior_qs");
  await expect(
    api.signReport(pid, { recommendedTendererId: "T-001" }),
  ).rejects.toMatchObject({ status: 403 });
  setMockRole("senior_qs");
  await expect(
    api.signReport(pid, { recommendedTendererId: "T-001" }),
  ).rejects.toMatchObject({ status: 409, code: "UNRESOLVED_FLAGS" });
  await expect(
    api.signReport(pid, { recommendedTendererId: "T-002" }),
  ).rejects.toMatchObject({ status: 400, code: "OVERRIDE_REASON_REQUIRED" });
  for (const flag of db.flags.filter(
    (flag) => ["critical", "high"].includes(flag.severity) && !flag.decision,
  ))
    await api.decide(flag.id, {
      action: "accept",
      reason: "Reviewed against cited evidence.",
    });
  const signed = await api.signReport(pid, { recommendedTendererId: "T-001" });
  expect(signed).toMatchObject({
    status: "signed",
    signedBy: "user-senior",
    version: 2,
  });
  await expect(
    api.decide("F-001", {
      action: "dismiss",
      reason: "Attempt to change the signed record.",
    }),
  ).rejects.toMatchObject({ status: 409, code: "VERSION_LOCKED" });
  const newDocument = await api.uploadDocument(
    pid,
    new File(["new draft"], "later.pdf", { type: "application/pdf" }),
    "priced_boq",
    "T-001",
  );
  setMockRole("owner_viewer");
  await expect(api.documentFile(newDocument.id)).rejects.toMatchObject({
    status: 403,
  });
  expect(await api.reports(pid)).toEqual([signed]);
  await expect(api.flags(pid)).rejects.toMatchObject({ status: 403 });
  expect((await api.documentFile("D-001")).type).toBe("application/pdf");
});
test("missing resources return 404", async () => {
  for (const request of [
    () => api.project("missing"),
    () => api.flags("missing"),
    () => api.flag("missing"),
    () => api.job("missing"),
    () => api.documentFile("missing"),
  ])
    await expect(request()).rejects.toMatchObject({ status: 404 });
});
