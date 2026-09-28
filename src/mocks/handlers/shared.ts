import { z } from "zod";
import { can, type Permission } from "@/lib/auth/permissions";
import { currentUser, db } from "../store";
export function failure(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status });
}
export function allowed(permission: Permission) {
  return can(currentUser(), permission)
    ? undefined
    : failure(
        403,
        "FORBIDDEN",
        "This action is not permitted for the current user.",
      );
}
export function projectGuard(
  id: string,
  permission: Permission = "project.view",
) {
  return (
    allowed(permission) ??
    (!db.projects.some((project) => project.id === id)
      ? failure(404, "NOT_FOUND", "Project not found.")
      : undefined)
  );
}
export function json<S extends z.ZodType>(
  schema: S,
  value: unknown,
  status = 200,
  headers?: HeadersInit,
) {
  return Response.json(schema.parse(value), { status, headers });
}
export async function input<S extends z.ZodType>(request: Request, schema: S) {
  try {
    return schema.safeParse(await request.json());
  } catch {
    return schema.safeParse(undefined);
  }
}
export const PAGE_SIZE = 100;
// Cursors bind the offset to its resource/filter scope; malformed/cross-scope cursors are rejected.
export function paginate<T>(items: T[], cursor: string | null, scope: string) {
  const prefix = encodeURIComponent(scope) + ":";
  let offset = 0;
  if (cursor) {
    if (
      !cursor.startsWith(prefix) ||
      !/^\d+$/.test(cursor.slice(prefix.length))
    )
      return null;
    offset = Number(cursor.slice(prefix.length));
    if (!Number.isSafeInteger(offset) || offset > items.length) return null;
  }
  const end = offset + PAGE_SIZE;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? prefix + end : undefined,
  };
}
