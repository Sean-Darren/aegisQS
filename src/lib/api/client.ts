import { z } from "zod";
export type ApiErrorKind = "http" | "network" | "validation" | "aborted";
export class ApiError extends Error {
  readonly name = "ApiError";
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status = 0,
    public readonly code?: string,
    public readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
const errorBodySchema = z.object({
  message: z.string().optional(),
  code: z.string().optional(),
});
export type ApiRequestOptions = Omit<RequestInit, "credentials">;
export function createApiClient(baseUrl = "/api/v1") {
  async function request<S extends z.ZodType>(
    path: string,
    schema: S,
    options: ApiRequestOptions = {},
    binary = false,
  ) {
    let response: Response;
    try {
      response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
        { ...options, credentials: "include" },
      );
    } catch (cause) {
      const aborted =
        options.signal?.aborted ||
        (cause instanceof Error && cause.name === "AbortError");
      throw new ApiError(
        aborted ? "Request cancelled." : "The API could not be reached.",
        aborted ? "aborted" : "network",
        0,
        undefined,
        undefined,
        { cause },
      );
    }
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      const parsed = errorBodySchema.safeParse(body);
      throw new ApiError(
        (parsed.success && parsed.data.message) ||
          `Request failed with status ${response.status}.`,
        "http",
        response.status,
        parsed.success ? parsed.data.code : undefined,
        body,
      );
    }
    let body: unknown;
    try {
      body = binary ? await response.blob() : await response.json();
    } catch (cause) {
      throw new ApiError(
        "The API returned an unreadable response.",
        "validation",
        response.status,
        undefined,
        undefined,
        { cause },
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        "The API response did not match its contract.",
        "validation",
        response.status,
        "INVALID_RESPONSE",
        parsed.error.issues,
      );
    return {
      data: parsed.data,
      nextCursor: response.headers.get("X-Next-Cursor") ?? undefined,
    };
  }
  return {
    async get<S extends z.ZodType>(
      path: string,
      schema: S,
      options: ApiRequestOptions = {},
    ) {
      return (await request(path, schema, options)).data;
    },
    page: request,
    async post<S extends z.ZodType>(
      path: string,
      schema: S,
      body: unknown,
      options: ApiRequestOptions = {},
    ) {
      const multipart = body instanceof FormData;
      const headers = new Headers(options.headers);
      if (!multipart) headers.set("Content-Type", "application/json");
      return (
        await request(path, schema, {
          ...options,
          method: "POST",
          headers,
          body: multipart ? body : JSON.stringify(body),
        })
      ).data;
    },
    async file(path: string, options: ApiRequestOptions = {}) {
      return (await request(path, z.instanceof(Blob), options, true)).data;
    },
  };
}
export const apiClient = createApiClient();
