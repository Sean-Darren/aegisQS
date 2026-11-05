import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { userSchema } from "@/schemas";
import { createProjectsHandlers } from "@/lib/domain/handlers/projects";
import { createDocumentsHandlers } from "@/lib/domain/handlers/documents";
import { createDrawingsHandlers } from "@/lib/domain/handlers/drawings";
import { createVariationsHandlers } from "@/lib/domain/handlers/variations";
import { createWorkbooksHandlers } from "@/lib/domain/handlers/workbooks";
import { createMaterialsHandlers } from "@/lib/domain/handlers/materials";
import { MockError } from "@/lib/domain/handlers/shared";
import { decodeState, projectFor } from "./records";
import { createPersistentContext } from "./context";
import { loadSnapshot, commitContext, hydrateFile } from "./repository";
export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const expected =
    process.env.SMART_QS_PUBLIC_ORIGIN ??
    `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (!origin || origin !== expected)
    throw new MockError(403, "A same-origin request is required.");
}
export async function authenticate(headers: Headers) {
  const auth = await createSupabaseServerClient(headers);
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();
  if (error || !user) throw new MockError(401, "Sign in to continue.");
  const db = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await db
    .from("user_profiles")
    .select("data")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError || !profile)
    throw new MockError(
      403,
      "Your account needs a Smart QS profile and project membership. Contact your administrator.",
    );
  return { user: userSchema.parse(profile.data), db };
}
export function errorResponse(error: unknown, headers: Headers) {
  const status =
    error instanceof MockError
      ? error.status
      : error instanceof z.ZodError ||
          error instanceof SyntaxError ||
          error instanceof RangeError
        ? 400
        : 500;
  return Response.json(
    {
      code:
        status === 401
          ? "UNAUTHENTICATED"
          : status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : status === 409
                ? "CONFLICT"
                : status === 400
                  ? "INVALID_REQUEST"
                  : "BACKEND_ERROR",
      message:
        error instanceof MockError
          ? error.message
          : status === 400
            ? "Check the submitted fields and try again."
            : "The server could not complete this request.",
    },
    { status, headers },
  );
}
export async function handleApi(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    assertSameOrigin(request);
    const { db, user } = await authenticate(headers);
    // Session reads need the authenticated profile, not the full project dataset.
    if (
      request.method === "GET" &&
      new URL(request.url).pathname === "/api/v1/me"
    )
      return Response.json(userSchema.parse(user), { headers });
    const snapshot = await loadSnapshot(db),
      state = decodeState(snapshot.records);
    const { ctx, events } = createPersistentContext(state, user);
    const routes = [
      ...createProjectsHandlers(ctx),
      ...createDocumentsHandlers(ctx),
      ...createDrawingsHandlers(ctx),
      ...createVariationsHandlers(ctx),
      ...createWorkbooksHandlers(ctx),
      ...createMaterialsHandlers(ctx),
    ];
    const path = new URL(request.url).pathname.replace(/^\/api\/v1/, "");
    for (const route of routes) {
      if (route.method !== request.method.toLowerCase()) continue;
      const names: string[] = [];
      const regex = new RegExp(
        "^" +
          route.path.replace(/:([A-Za-z]+)/g, (_, name) => {
            names.push(name);
            return "([^/]+)";
          }) +
          "/?$",
      );
      const match = regex.exec(path);
      if (!match) continue;
      const params = Object.fromEntries(
        names.map((name, i) => [name, decodeURIComponent(match[i + 1])]),
      );
      // Fetch file bytes only after membership is verified. Parsing/remapping stays server-side.
      let fileId =
        path.includes("/document-versions/") ||
        (path.includes("/workbook-versions/") && path.endsWith("/download"))
          ? params.versionId
          : undefined;
      if (route.method === "put" && path.endsWith("/mapping"))
        fileId = state.workbooks.find(
          (w) => w.id === params.workbookId,
        )?.currentVersionId;
      if (fileId) {
        const projectId = projectFor(
          state,
          path.includes("/document-versions/")
            ? "document_version"
            : "workbook_version",
          fileId,
        );
        if (
          !projectId ||
          !state.projects.some(
            (p) => p.id === projectId && p.memberIds.includes(user.id),
          )
        )
          throw new MockError(403, "Project access is required.");
        await hydrateFile(db, ctx, snapshot.records, fileId);
        // Hydrated originals must not be re-uploaded during commit.
      }
      const hydrated = new Set(ctx.uploadedFiles.keys());
      const response = await route.resolver({ request, params });
      if (request.method !== "GET") {
        for (const id of hydrated) ctx.uploadedFiles.delete(id);
        await commitContext(
          db,
          ctx,
          snapshot.records,
          snapshot.revision,
          events,
        );
      }
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    }
    throw new MockError(404, "API endpoint not found.");
  } catch (error) {
    return errorResponse(error, headers);
  }
}
