import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  assertSameOrigin,
  authenticate,
  errorResponse,
} from "@/lib/backend/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function maxUploadBytes() {
  const parsed = Number(process.env.AEGISQS_BIM_MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_UPLOAD_BYTES;
}

function pythonBinary() {
  return process.env.PYTHON_BIN || "/opt/anaconda3/bin/python";
}

/** Find the Python bridge script regardless of the Next.js server cwd. */
function revisionScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "backend", "scripts", "revision_compare.py"),
    // __dirname = .../src/app/api/v1/bim/revision-comparisons
    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "..",
      "backend",
      "scripts",
      "revision_compare.py",
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
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

async function runLocalPythonWorker(
  base: File,
  target: File,
): Promise<unknown> {
  const dir = await mkdtemp(path.join(tmpdir(), "aegisqs-hf-revision-"));
  const basePath = path.join(dir, safeFileName(base.name, "base"));
  const targetPath = path.join(dir, safeFileName(target.name, "target"));

  try {
    await writeFile(basePath, Buffer.from(await base.arrayBuffer()));
    await writeFile(targetPath, Buffer.from(await target.arrayBuffer()));
    const script = revisionScriptPath();
    const { stdout, stderr } = await execFileAsync(
      pythonBinary(),
      [script, basePath, targetPath],
      { maxBuffer: 20 * 1024 * 1024, timeout: 300000 },
    );
    if (stderr.trim())
      console.warn("[hf-revision] python stderr:", stderr.trim());
    return JSON.parse(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
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
        const payload = await runLocalPythonWorker(base, target);
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
