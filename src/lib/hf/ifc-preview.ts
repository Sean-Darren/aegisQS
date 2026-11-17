import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function pythonBinary(): string {
  return process.env.PYTHON_BIN || "/opt/anaconda3/bin/python";
}

/** Find the IFC preview renderer regardless of the Next.js server cwd. */
function renderScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "backend", "scripts", "render_ifc_preview.py"),
    // __dirname = .../src/lib/hf
    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "backend",
      "scripts",
      "render_ifc_preview.py",
    ),
    process.env.PYTHON_SCRIPT_PATH ?? "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return (
    candidates[0] ||
    path.resolve(process.cwd(), "backend", "scripts", "render_ifc_preview.py")
  );
}

/** Render an IFC file to a PNG buffer using the local Python renderer. */
export async function renderIfcPreviewBytes(file: File): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "aegisqs-ifc-preview-"));
  const filePath = path.join(dir, "model.ifc");

  try {
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    const { stdout, stderr } = await execFileAsync(
      pythonBinary(),
      [renderScriptPath(), filePath],
      {
        encoding: "buffer",
        maxBuffer: 20 * 1024 * 1024,
        timeout: 120000,
      },
    );
    if (stderr?.length) {
      console.warn(
        "[ifc-preview] python stderr:",
        Buffer.from(stderr).toString().trim(),
      );
    }
    return Buffer.from(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
