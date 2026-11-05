import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { createApiClient } from "@/lib/api";
afterEach(() => vi.unstubAllGlobals());
class UploadRequest {
  static latest: UploadRequest;
  static auto = true;
  withCredentials = false;
  status = 201;
  responseText = '{"id":"saved"}';
  headers: Record<string, string> = {};
  upload: {
    onprogress?: (event: {
      lengthComputable: boolean;
      loaded: number;
      total: number;
    }) => void;
  } = {};
  onerror?: () => void;
  onabort?: () => void;
  onload?: () => void;
  url = "";
  constructor() {
    UploadRequest.latest = this;
  }
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send() {
    if (UploadRequest.auto)
      queueMicrotask(() => {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 5,
          total: 10,
        });
        this.onload?.();
      });
  }
  abort() {
    this.onabort?.();
  }
}
test("XHR upload reports genuine progress, sends cookies and parses the response", async () => {
  UploadRequest.auto = true;
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const progress: number[] = [];
  const result = await createApiClient("http://localhost/api/v1").upload(
    "/documents/test/versions",
    z.object({ id: z.string() }),
    new FormData(),
    { onProgress: (p) => progress.push(p) },
  );
  expect(result.id).toBe("saved");
  expect(UploadRequest.latest.withCredentials).toBe(true);
  expect(progress).toEqual([0, 50, 100]);
  expect(UploadRequest.latest.headers["Content-Type"]).toBeUndefined();
});
test("upload cancellation normalizes to ApiError", async () => {
  UploadRequest.auto = false;
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const controller = new AbortController();
  const pending = createApiClient().upload(
    "/documents/test/versions",
    z.object({}),
    new FormData(),
    { signal: controller.signal, onProgress: () => {} },
  );
  controller.abort();
  await expect(pending).rejects.toMatchObject({ kind: "aborted" });
});
