import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPendingJobs } from "@/lib/backend/jobs";
function queue(comparisons: unknown, workbooks: unknown, error?: object) {
  return {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            limit: async () => ({
              data: table === "drawing_comparisons" ? comparisons : workbooks,
              error,
            }),
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient;
}
test("an idle queue needs no full project snapshot", async () => {
  expect(await hasPendingJobs(queue([], []))).toBe(false);
});
test("either a comparison or a workbook check wakes the worker", async () => {
  expect(await hasPendingJobs(queue([{ id: "CMP-1" }], []))).toBe(true);
  expect(await hasPendingJobs(queue([], [{ id: "WV-3" }]))).toBe(true);
});
test("queue failures and invalid data must not be mistaken for no pending jobs", async () => {
  await expect(
    hasPendingJobs(queue(null, [], { code: "timeout" })),
  ).rejects.toThrow("job queue");
  await expect(hasPendingJobs(queue([{ id: 123 }], []))).rejects.toThrow();
});
