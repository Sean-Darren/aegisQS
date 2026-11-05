import { afterEach, expect, test, vi } from "vitest";
import { connectProjectSocket } from "@/lib/ws/client";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
test("persistent mode uses cookie SSE and the unchanged WsEvent decoder", () => {
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "disabled");
  vi.stubGlobal("location", { origin: "https://smartqs.example" });
  const source = {
    onopen: undefined as (() => void) | undefined,
    onmessage: undefined as ((event: { data: string }) => void) | undefined,
    onerror: undefined as (() => void) | undefined,
    close: vi.fn(),
  };
  const Constructor = vi.fn(function (...args: unknown[]) {
    void args;
    return source;
  });
  vi.stubGlobal("EventSource", Constructor);
  const onEvent = vi.fn(),
    onError = vi.fn(),
    onOpen = vi.fn();
  const close = connectProjectSocket("P-001", { onEvent, onError, onOpen });
  expect(String(Constructor.mock.calls[0][0])).toContain("/ws?projectId=P-001");
  source.onopen?.();
  expect(onOpen).toHaveBeenCalledOnce();
  source.onmessage?.({
    data: JSON.stringify({
      type: "document.version_added",
      documentId: "D-1",
      versionId: "DV-1",
      conflict: false,
    }),
  });
  expect(onEvent).toHaveBeenCalledOnce();
  source.onmessage?.({ data: '{"type":"invalid"}' });
  expect(onError).toHaveBeenCalledOnce();
  close();
  expect(source.close).toHaveBeenCalledOnce();
});
