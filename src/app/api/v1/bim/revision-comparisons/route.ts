import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

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
      "..", "..", "..", "..", "..", "..",
      "backend", "scripts", "revision_compare.py",
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

async function runLocalPythonWorker(
  base: File,
  target: File,
): Promise<unknown> {
  const dir = await mkdtemp(path.join(tmpdir(), "aegisqs-hf-revision-"));
  const basePath = path.join(dir, base.name || "base");
  const targetPath = path.join(dir, target.name || "target");

  try {
    await writeFile(basePath, Buffer.from(await base.arrayBuffer()));
    await writeFile(targetPath, Buffer.from(await target.arrayBuffer()));
    const script = revisionScriptPath();
    const { stdout, stderr } = await execFileAsync(
      pythonBinary(),
      [script, basePath, targetPath],
      { maxBuffer: 20 * 1024 * 1024, timeout: 300000 },
    );
    if (stderr.trim()) console.warn("[hf-revision] python stderr:", stderr.trim());
    return JSON.parse(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function POST(request: Request) {
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
      { status: 400 },
    );
  }

  if (workerUrl) {
    const upstream = new FormData();
    upstream.set("base", base, base.name || "base");
    upstream.set("target", target, target.name || "target");

    const upstreamResponse = await fetch(
      `${workerUrl}/api/v1/bim/revision-comparisons`,
      { method: "POST", body: upstream },
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
        { status: 502 },
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
      return NextResponse.json(payload);
    } catch (error) {
      return NextResponse.json(
        {
          code: "HF_LOCAL_WORKER_ERROR",
          message:
            error instanceof Error ? error.message : "Local HF worker failed.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    {
      code: "HF_WORKER_NOT_CONFIGURED",
      message: "Hugging Face revision worker is not configured.",
    },
    { status: 503 },
  );
}
