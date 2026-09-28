import { expect, test, vi } from "vitest";
import { createApiClient, createResources } from "@/lib/api";
import { db, setMockRole } from "@/mocks/store";

const api = createResources(createApiClient("http://localhost/api/v1"));

test("failed document parsing can be re-processed, but parsed documents cannot", async () => {
  const document = db.documents[0];
  await expect(api.reprocessDocument(document.id)).rejects.toMatchObject({
    status: 409,
  });
  document.parseStatus = "failed";
  document.parseError = "The uploaded file could not be parsed.";
  const queued = await api.reprocessDocument(document.id);
  expect(queued.parseStatus).toBe("queued");
  expect(queued.parseError).toBeUndefined();
  await vi.waitFor(
    async () =>
      expect((await api.documents("P-001"))[0].parseStatus).toBe("parsed"),
    { timeout: 2500 },
  );
});

test("a failed auditor can be retried alone and rejoins the job result", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    const job = db.jobs[0];
    job.status = "partial";
    const failed = job.progress[0];
    failed.status = "failed";
    failed.pct = 40;
    failed.error = "Source file needs review.";
    const running = await api.retryAuditor(
      job.id,
      failed.tendererId,
      failed.auditor,
    );
    expect(running.status).toBe("running");
    expect(running.progress[0].status).toBe("running");
    await expect(
      api.retryAuditor(job.id, failed.tendererId, failed.auditor),
    ).rejects.toMatchObject({ status: 409 });
    await vi.advanceTimersByTimeAsync(5000);
    const finished = await api.job(job.id);
    expect(finished.status).toBe("succeeded");
    expect(finished.progress[0]).toMatchObject({
      status: "succeeded",
      pct: 100,
    });
  } finally {
    vi.useRealTimers();
  }
});

test("retry endpoints obey the existing permissions", async () => {
  db.documents[0].parseStatus = "failed";
  db.jobs[0].status = "partial";
  db.jobs[0].progress[0].status = "failed";
  setMockRole("admin");
  await expect(api.reprocessDocument(db.documents[0].id)).rejects.toMatchObject(
    { status: 403 },
  );
  await expect(
    api.retryAuditor(db.jobs[0].id, "T-001", "scope_completeness"),
  ).rejects.toMatchObject({ status: 403 });
});

test("the mock backend also blocks analysis without a parsed priced BOQ", async () => {
  for (const document of db.documents) document.parseStatus = "queued";
  await expect(api.runAnalysis("P-001")).rejects.toMatchObject({
    status: 409,
    code: "PRICED_BOQ_REQUIRED",
  });
});
