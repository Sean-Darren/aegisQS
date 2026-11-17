import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  authenticate,
  errorResponse,
} from "@/lib/backend/api";
import { renderIfcPreviewBytes } from "@/lib/hf/ifc-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    assertSameOrigin(request);
    await authenticate(headers);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          code: "INVALID_REQUEST",
          message: "An IFC file is required.",
        },
        { status: 400, headers },
      );
    }

    if (!file.name.toLowerCase().endsWith(".ifc")) {
      return NextResponse.json(
        {
          code: "INVALID_REQUEST",
          message: "Only .ifc files can be rendered to a 2D preview.",
        },
        { status: 415, headers },
      );
    }

    const png = await renderIfcPreviewBytes(file);
    headers.set("Content-Type", "image/png");
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers,
    });
  } catch (error) {
    return errorResponse(error, headers);
  }
}
