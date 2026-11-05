import { z } from "zod";
import {
  userSchema,
  projectSchema,
  workbookSchema,
  workbookVersionSchema,
  workbookCheckSchema,
} from "@schemas";
async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestInit = {},
) {
  const r = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "include",
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "Sign in to Smart QS first."
        : `Smart QS request failed (${r.status}). Try again.`,
    );
  return schema.parse(await r.json());
}
export const api = {
  me: () => request("/me", userSchema),
  projects: () => request("/projects", z.array(projectSchema)),
  workbooks: (id: string) =>
    request(
      `/projects/${encodeURIComponent(id)}/workbooks`,
      z.array(workbookSchema),
    ),
  version: (id: string) =>
    request(
      `/workbook-versions/${encodeURIComponent(id)}`,
      workbookVersionSchema,
    ),
  checks: (id: string) =>
    request(
      `/workbook-versions/${encodeURIComponent(id)}/checks`,
      z.array(workbookCheckSchema),
    ),
  async save(id: string, file: File) {
    const body = new FormData();
    body.set("file", file);
    return request(
      `/workbooks/${encodeURIComponent(id)}/versions`,
      workbookVersionSchema,
      { method: "POST", body },
    );
  },
};
