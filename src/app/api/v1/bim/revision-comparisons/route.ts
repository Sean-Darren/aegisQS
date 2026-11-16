import { NextResponse } from "next/server";
import path from "node:path";
import {
  assertSameOrigin,
  authenticate,
  errorResponse,
} from "@/lib/backend/api";
import { runHfRevisionBridge } from "@/lib/hf/revision-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function maxUploadBytes() {
  const parsed = Number(process.env.AEGISQS_BIM_MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_UPLOAD_BYTES;
}

/**
 * Reduce a client-supplied multipart filename to a bare, writable file name.
 * `path.basename` strips directory components, control characters are
 * dropped and the length is capped, so "../.." or absolute paths can never
 * escape the per-request temp directory.
 */
function safeFileName(name: string | undefined, fallback: string): string {
  const raw = path.basename(name ?? "");
  let safe = "";
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0x1f && code !== 0x7f) safe += char;
  }
  safe = safe.trim().slice(0, 128);
  return safe || fallback;
}

export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    // Same gate as every other /api/v1 route: same-origin request from a
    // signed-in user with a Smart QS profile.
    assertSameOrigin(request);
    await authenticate(headers);

    const workerUrl = process.env.AEGISQS_BIM_WORKER_URL?.replace(/\/$/, "");

    const form = await request.formData();
    const base = form.get("base");
    const target = form.get("target");
    if (!(base instanceof File) || !(target instanceof File)) {
      return NextResponse.json(
        {
          code: "INVALID_REQUEST",
          message: "Both base and target revision files are required.",
        },
        { status: 400, headers },
      );
    }

    const limit = maxUploadBytes();
    if (base.size > limit || target.size > limit) {
      return NextResponse.json(
        {
          code: "INVALID_REQUEST",
          message: `Each revision file must be at most ${Math.floor(
            limit / (1024 * 1024),
          )} MB.`,
        },
        { status: 413, headers },
      );
    }

    if (workerUrl) {
      const upstream = new FormData();
      upstream.set("base", base, safeFileName(base.name, "base"));
      upstream.set("target", target, safeFileName(target.name, "target"));

      // Server-to-server call: authenticate with the shared worker token
      // when one is configured (the worker gates on Origin or bearer token).
      const workerToken = process.env.AEGISQS_BIM_WORKER_TOKEN?.trim();
      const upstreamResponse = await fetch(
        `${workerUrl}/api/v1/bim/revision-comparisons`,
        {
          method: "POST",
          body: upstream,
          headers: workerToken
            ? { Authorization: "Bearer " + workerToken }
            : undefined,
        },
      );

      if (!upstreamResponse.ok) {
        const text = await upstreamResponse.text();
        return NextResponse.json(
          {
            code: "HF_WORKER_ERROR",
            message: `Hugging Face revision worker returned ${upstreamResponse.status}: ${text.slice(
              0,
              180,
            )}`,
          },
          { status: 502, headers },
        );
      }

      return new NextResponse(upstreamResponse.body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (process.env.AEGISQS_HF_LOCAL_FALLBACK !== "disabled") {
      try {
        const payload = await runHfRevisionBridge({
          baseBytes: await base.arrayBuffer(),
          baseName: safeFileName(base.name, "base"),
          targetBytes: await target.arrayBuffer(),
          targetName: safeFileName(target.name, "target"),
        });
        return NextResponse.json(payload, { headers });
      } catch (error) {
        return NextResponse.json(
          {
            code: "HF_LOCAL_WORKER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Local HF worker failed.",
          },
          { status: 502, headers },
        );
      }
    }

    return NextResponse.json(
      {
        code: "HF_WORKER_NOT_CONFIGURED",
        message: "Hugging Face revision worker is not configured.",
      },
      { status: 503, headers },
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
