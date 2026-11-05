import { http, HttpResponse } from "msw";
import { z } from "zod";
import { mockContext } from "../context";
import { createHelpers, type DomainRoute } from "@/lib/domain/handlers/shared";
export { MockError } from "@/lib/domain/handlers/shared";
export const {
  reply,
  requirePermission,
  requireProject,
  find,
  document,
  workbook,
  workbookVersion,
  paged,
  fileInput,
  addVersion,
  bytesFor,
  fileReply,
} = createHelpers(mockContext);
export function adaptRoutes(routes: DomainRoute[]) {
  return routes.map(({ method, path, resolver }) =>
    http[method](`*/api/v1${path}`, async ({ request, params }) => {
      try {
        return await resolver({
          request,
          params: params as Record<string, string>,
        });
      } catch (error) {
        const status =
          error && typeof error === "object" && "status" in error
            ? Number(error.status)
            : error instanceof z.ZodError ||
                error instanceof SyntaxError ||
                error instanceof RangeError
              ? 400
              : 500;
        return HttpResponse.json(
          {
            code:
              status === 400
                ? "INVALID_REQUEST"
                : status === 403
                  ? "FORBIDDEN"
                  : status === 404
                    ? "NOT_FOUND"
                    : status === 409
                      ? "CONFLICT"
                      : "MOCK_ERROR",
            message: error instanceof Error ? error.message : "Request failed.",
          },
          { status },
        );
      }
    }),
  );
}
