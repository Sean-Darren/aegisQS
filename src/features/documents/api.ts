import { ApiError } from "@/lib/api/client";
import { projectDocumentSchema, type ProjectDocument } from "@/schemas";
import type { UploadSelection } from "./validation";

/** XHR is used only where the fetch API cannot expose upload byte progress. */
export function uploadDocumentWithProgress(
  projectId: string,
  selection: UploadSelection,
  onProgress: (pct: number) => void,
): Promise<ProjectDocument> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `/api/v1/projects/${encodeURIComponent(projectId)}/documents`,
    );
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("error", () =>
      reject(new ApiError("The API could not be reached.", "network")),
    );
    xhr.addEventListener("abort", () =>
      reject(new ApiError("Request cancelled.", "aborted")),
    );
    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const body =
          xhr.response && typeof xhr.response === "object"
            ? (xhr.response as { message?: string; code?: string })
            : {};
        reject(
          new ApiError(
            body.message ?? `Request failed with status ${xhr.status}.`,
            "http",
            xhr.status,
            body.code,
            body,
          ),
        );
        return;
      }
      const parsed = projectDocumentSchema.safeParse(xhr.response);
      if (!parsed.success) {
        reject(
          new ApiError(
            "The API response did not match its contract.",
            "validation",
            xhr.status,
            "INVALID_RESPONSE",
            parsed.error.issues,
          ),
        );
        return;
      }
      onProgress(100);
      resolve(parsed.data);
    });
    const form = new FormData();
    form.set("file", selection.file);
    form.set("type", selection.type);
    if (selection.tendererId) form.set("tendererId", selection.tendererId);
    xhr.send(form);
  });
}
