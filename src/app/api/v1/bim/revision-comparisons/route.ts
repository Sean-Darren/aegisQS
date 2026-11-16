import { NextResponse } from "next/server";
import { runHfRevisionBridge } from "@/lib/hf/revision-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      const payload = await runHfRevisionBridge({
        baseBytes: await base.arrayBuffer(),
        baseName: base.name || "base",
        targetBytes: await target.arrayBuffer(),
        targetName: target.name || "target",
      });
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
