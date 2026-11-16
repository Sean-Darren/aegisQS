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

/** Find the Python bridge script regardless of the Next.js server cwd. */
function revisionScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "backend", "scripts", "revision_compare.py"),
    // __dirname fallback only works inside the Next.js app directory.
    // Callers outside the app dir must rely on cwd or set PYTHON_SCRIPT_PATH.
    process.env.PYTHON_SCRIPT_PATH ?? "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0] || path.resolve(process.cwd(), "backend", "scripts", "revision_compare.py");
}

export interface HfRevisionInput {
  baseBytes: ArrayBuffer;
  baseName: string;
  targetBytes: ArrayBuffer;
  targetName: string;
}

export interface HfRevisionResult {
  model_version: string;
  base_materials: Array<Record<string, unknown>>;
  target_materials: Array<Record<string, unknown>>;
  changes: Array<{
    bbox: { x: number; y: number; w: number; h: number };
    kind: "added" | "removed" | "modified";
    summary: string;
    confidence: number;
    textBefore?: string | null;
    textAfter?: string | null;
  }>;
}

/**
 * Run the Hugging Face revision comparison Python bridge.
 *
 * Passes ``HF_TOKEN`` (and ``HUGGING_FACE_HUB_TOKEN``) through to the
 * Python child process so the transformers library can authenticate.
 */
export async function runHfRevisionBridge(
  input: HfRevisionInput,
): Promise<HfRevisionResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "aegisqs-hf-revision-"));
  const basePath = path.join(dir, input.baseName || "base");
  const targetPath = path.join(dir, input.targetName || "target");

  try {
    await writeFile(basePath, Buffer.from(input.baseBytes));
    await writeFile(targetPath, Buffer.from(input.targetBytes));

    const script = revisionScriptPath();
    const env: Record<string, string> = {};

    // Forward HF authentication tokens to the Python subprocess.
    // transformers / huggingface_hub auto-detect these env vars.
    // Strip surrounding quotes in case the token was pasted quoted.
    const cleanToken = (value: string | undefined): string | undefined => {
      if (!value) return undefined;
      const trimmed = value.trim();
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    };
    const hfToken = cleanToken(process.env.HF_TOKEN);
    const hfHubToken = cleanToken(process.env.HUGGING_FACE_HUB_TOKEN);
    if (hfToken) {
      env.HF_TOKEN = hfToken;
    }
    if (hfHubToken) {
      env.HUGGING_FACE_HUB_TOKEN = hfHubToken;
    }

    const { stdout, stderr } = await execFileAsync(
      pythonBinary(),
      [script, basePath, targetPath],
      {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 300000,
        env: { ...process.env, ...env },
      },
    );

    if (stderr.trim()) {
      console.warn("[hf-revision] python stderr:", stderr.trim());
    }

    return JSON.parse(stdout) as HfRevisionResult;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
