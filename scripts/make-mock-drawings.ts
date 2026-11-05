import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = "public/mock-files";
const W = 2384,
  H = 1684;
const boxes = {
  a201: [
    {
      kind: "modified",
      summary: "Slab opening enlarged from 1.2 × 1.2 m to 1.8 × 1.5 m",
      bbox: { x: 0.16, y: 0.21, w: 0.22, h: 0.18 },
    },
    {
      kind: "added",
      summary: "Additional beam added",
      bbox: { x: 0.53, y: 0.23, w: 0.29, h: 0.12 },
    },
    {
      kind: "removed",
      summary: "Partition wall removed",
      bbox: { x: 0.23, y: 0.51, w: 0.1, h: 0.23 },
    },
    {
      kind: "dimension",
      summary: "Dimension changed from 3,600 to 4,200",
      textBefore: "3,600",
      textAfter: "4,200",
      bbox: { x: 0.55, y: 0.59, w: 0.27, h: 0.13 },
    },
  ],
  s110: [
    {
      kind: "added",
      summary: "Steel member added",
      bbox: { x: 0.53, y: 0.23, w: 0.29, h: 0.12 },
    },
    {
      kind: "modified",
      summary: "Column section increased",
      bbox: { x: 0.16, y: 0.21, w: 0.22, h: 0.18 },
    },
  ],
};
const manifest: Record<
  string,
  {
    path: string;
    sha256: string;
    sizeBytes: number;
    mimeType: string;
    pageCount: number;
    contentBase64: string;
  }
> = {};
for (const [number, revisions] of [
  ["A-201", ["A", "B", "C"]],
  ["S-110", ["P1", "P2"]],
] as const) {
  for (const revision of revisions) {
    const pdf = await PDFDocument.create();
    pdf.setCreationDate(new Date("2026-11-01T00:00:00Z"));
    pdf.setModificationDate(new Date("2026-11-01T00:00:00Z"));
    pdf.setTitle(`${number} construction drawing`);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([W, H]);
    const rect = (x: number, y: number, w: number, h: number) =>
      page.drawRectangle({
        x: x * W,
        y: (1 - y - h) * H,
        width: w * W,
        height: h * H,
        borderColor: rgb(0, 0, 0),
        borderWidth: 3,
      });
    const text = (value: string, x: number, y: number, size = 24) =>
      page.drawText(value, {
        x: x * W,
        y: (1 - y) * H,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    rect(0.06, 0.06, 0.88, 0.87);
    rect(0.1, 0.16, 0.8, 0.66);
    text(number, 0.1, 0.11, 40);
    text(
      number === "A-201" ? "Level 2 floor plan" : "Structural framing plan",
      0.3,
      0.11,
      32,
    );
    for (const x of [0.1, 0.5, 0.9]) {
      page.drawLine({
        start: { x: x * W, y: 0.18 * H },
        end: { x: x * W, y: 0.84 * H },
        thickness: 2,
      });
    }
    if (number === "A-201") {
      const newer = revision === "C";
      rect(
        0.18,
        0.24,
        newer ? 0.15 : revision === "A" ? 0.08 : 0.1,
        newer ? 0.1 : 0.08,
      );
      text("Slab opening", 0.18, 0.36, 20);
      if (newer) {
        rect(0.55, 0.28, 0.25, 0.018);
        text("Beam B7", 0.55, 0.32, 20);
      }
      if (!newer) {
        rect(0.27, 0.54, 0.012, 0.17);
        text("P1", 0.25, 0.73, 18);
      }
      text(newer ? "4,200" : "3,600", 0.6, 0.66, 32);
    } else {
      rect(
        0.2,
        0.26,
        revision === "P2" ? 0.08 : 0.05,
        revision === "P2" ? 0.08 : 0.05,
      );
      if (revision === "P2") {
        rect(0.55, 0.28, 0.25, 0.018);
        text("Member S3", 0.55, 0.32, 20);
      }
    }
    const bytes = await pdf.save({ useObjectStreams: false });
    const path = `drawings/${number}-rev-${revision}.pdf`;
    await mkdir(`${directory}/drawings`, { recursive: true });
    await writeFile(`${directory}/${path}`, bytes);
    manifest[`${number}-${revision}`] = {
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
      mimeType: "application/pdf",
      pageCount: 1,
      contentBase64: Buffer.from(bytes).toString("base64"),
    };
  }
}
// Neutral hub records provide actual downloadable bytes for non-drawing examples.
for (const [key, name, note] of [
  ["record", "sample-record.pdf", "Issued copy"],
  [
    "record-alternative",
    "sample-record-alternative.pdf",
    "Alternative issued copy",
  ],
]) {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date("2026-11-01T00:00:00Z"));
  pdf.setModificationDate(new Date("2026-11-01T00:00:00Z"));
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Sample project record", { x: 48, y: 760, size: 22, font });
  page.drawText("P-001 Central Market Rehab Phase 2", {
    x: 48,
    y: 710,
    size: 14,
    font,
  });
  page.drawText(note, { x: 48, y: 670, size: 14, font });
  page.drawText("Illustrative document for preview and version tests.", {
    x: 48,
    y: 630,
    size: 12,
    font,
  });
  const sample = await pdf.save({ useObjectStreams: false });
  await mkdir(`${directory}/documents`, { recursive: true });
  const path = `documents/${name}`;
  await writeFile(`${directory}/${path}`, sample);
  manifest[key] = {
    path,
    sha256: createHash("sha256").update(sample).digest("hex"),
    sizeBytes: sample.length,
    mimeType: "application/pdf",
    pageCount: 1,
    contentBase64: Buffer.from(sample).toString("base64"),
  };
}
await writeFile(
  "src/mocks/fixtures/drawing-regions.json",
  JSON.stringify(boxes, null, 2) + "\n",
);
await writeFile(
  "src/mocks/fixtures/drawing-files.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Generated five vector drawing revisions and matching top-left normalized regions.",
);
