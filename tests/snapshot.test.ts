import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSnapshot } from "@/lib/backend/repository";
function client(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as SupabaseClient;
}
test("concurrent reads share one RPC, but the next read fetches a fresh revision", async () => {
  let finish!: (value: unknown) => void;
  const rpc = vi.fn().mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const db = client(rpc);
  const first = loadSnapshot(db);
  const second = loadSnapshot(db);
  expect(rpc).toHaveBeenCalledTimes(1);
  finish({ data: { revision: 1, records: [] }, error: null });
  expect(await first).toEqual(await second);
  rpc.mockResolvedValueOnce({
    data: { revision: 2, records: [] },
    error: null,
  });
  expect((await loadSnapshot(db)).revision).toBe(2);
  expect(rpc).toHaveBeenCalledTimes(2);
});
test("failed reads are evicted so retry can recover", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: { code: "timeout" } });
  const db = client(rpc);
  await expect(loadSnapshot(db)).rejects.toThrow("Database is not ready");
  rpc.mockResolvedValueOnce({
    data: { revision: 3, records: [] },
    error: null,
  });
  expect((await loadSnapshot(db)).revision).toBe(3);
});
test("different clients never share snapshots", async () => {
  const a = vi
    .fn()
    .mockResolvedValue({ data: { revision: 1, records: [] }, error: null });
  const b = vi
    .fn()
    .mockResolvedValue({ data: { revision: 9, records: [] }, error: null });
  const [first, second] = await Promise.all([
    loadSnapshot(client(a)),
    loadSnapshot(client(b)),
  ]);
  expect(first.revision).toBe(1);
  expect(second.revision).toBe(9);
});

test("a committed change prevents later reads from joining a pre-commit snapshot", async () => {
  const { commitContext } = await import("@/lib/backend/repository");
  const { createPersistentContext } = await import("@/lib/backend/context");
  const { emptyState, encodeState } = await import("@/lib/backend/records");
  let finish!: (value: unknown) => void;
  const rpc = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    )
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ data: { revision: 2, records: [] }, error: null });
  const db = client(rpc);
  const oldRead = loadSnapshot(db);
  const { ctx } = createPersistentContext(emptyState(), {
    id: "system",
    name: "System",
    email: "system@example.test",
    role: "admin",
    locale: "en",
  });
  await commitContext(db, ctx, encodeState(ctx.state), 1, [
    { table: "project_events", id: "event-1", projectId: "P-001", data: {} },
  ]);
  expect((await loadSnapshot(db)).revision).toBe(2);
  finish({ data: { revision: 1, records: [] }, error: null });
  expect((await oldRead).revision).toBe(1);
});
