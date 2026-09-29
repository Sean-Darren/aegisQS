// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFlagDisposition } from "@/features/flags/api";
import { flagInboxStats } from "@/features/flags/model";
import { queryKeys, resources } from "@/lib/api";
import { createFixtures } from "@/mocks/fixtures/data";
import type { Flag } from "@/schemas";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("final decision updates the inbox and blocking count optimistically, then rolls back on error", async () => {
  const flag = createFixtures().flags[0];
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(queryKeys.flags(flag.projectId), [flag]);
  client.setQueryData(queryKeys.flag(flag.id), flag);
  let rejectRequest: (error: Error) => void = () => {};
  vi.spyOn(resources, "decide").mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
  );
  const { result } = renderHook(
    () => useFlagDisposition(flag.projectId, "user-senior"),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  let request: Promise<Flag> = Promise.resolve(flag);
  act(() => {
    request = result.current.mutateAsync({
      flagId: flag.id,
      kind: "decision",
      action: "accept",
      reason: "The source supports this decision.",
    });
  });
  await waitFor(() => {
    expect(
      flagInboxStats(
        client.getQueryData<Flag[]>(queryKeys.flags(flag.projectId))!,
      ).blocking,
    ).toBe(0);
    expect(client.getQueryData<Flag>(queryKeys.flag(flag.id))?.status).toBe(
      "accepted",
    );
  });
  await act(async () => {
    rejectRequest(new Error("The API rejected this decision."));
    await expect(request).rejects.toThrow();
  });
  expect(
    flagInboxStats(
      client.getQueryData<Flag[]>(queryKeys.flags(flag.projectId))!,
    ).blocking,
  ).toBe(1);
  expect(client.getQueryData<Flag>(queryKeys.flag(flag.id))?.status).toBe(
    flag.status,
  );
});
