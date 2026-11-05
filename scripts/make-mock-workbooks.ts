import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseWorkbook } from "../src/mocks/workbook-engine.ts";
const trades = [
  "Preliminaries",
  "Concrete repair",
  "Reinforcement",
  "Waterproofing",
  "External walls",
  "Windows",
  "Drainage",
  "Fire services",
  "E&M",
];
import { seededRandom } from "../src/mocks/fixtures/random.ts";
const random = seededRandom();
const lines = Array.from({ length: 600 }, (_, i) => {
  const trade = trades[Math.floor((i * 9) / 600)];
  return {
    ref: `${Math.floor((i * 9) / 600) + 1}.${i + 1}`,
    description: `${trade} work item ${i + 1}`,
    unit: ["item", "m³", "kg", "m²", "m²", "no.", "m", "no.", "item"][
      Math.floor((i * 9) / 600)
    ],
    quantity: Math.round(10 + random() * 90),
    rate:
      Math.round(
        [1000, 3600, 7, 95, 220, 1800, 320, 850, 2400][
          Math.floor((i * 9) / 600)
        ] *
          (1 + random() * 0.05) *
          100,
      ) / 100,
    trade,
    materialId: "",
  };
});
lines[0] = {
  ref: "3.2.14",
  description: "High-tensile rebar",
  unit: "tonne",
  quantity: 40,
  rate: 7000,
  trade: "Reinforcement",
  materialId: "rebar",
};
lines[1] = {
  ref: "2.1.08",
  description: "Concrete to additional beams",
  unit: "m³",
  quantity: 100,
  rate: 3600,
  trade: "Concrete repair",
  materialId: "concrete",
};
lines[2] = {
  ref: "2.4.03",
  description: "Formwork to beam sides",
  unit: "m²",
  quantity: 500,
  rate: 850,
  trade: "Concrete repair",
  materialId: "timber",
};
const manifest: Record<
  string,
  {
    path: string;
    sha256: string;
    sizeBytes: number;
    mimeType: string;
    contentBase64: string;
  }
> = {};
const parsed: Record<string, Awaited<ReturnType<typeof parseWorkbook>>> = {};
for (const version of [1, 2]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Smart QS";
  workbook.created = new Date("2026-11-01T00:00:00Z");
  workbook.modified = workbook.created;
  const sheet = workbook.addWorksheet("BOQ");
  sheet.addRow([
    "Item ref",
    "Description",
    "Unit",
    "Quantity",
    "Rate",
    "Amount",
    "Section",
    "Material",
  ]);
  let start = 2,
    section = lines[0].trade,
    subtotal = 0;
  const sectionRows: number[] = [];
  function total() {
    const row = sheet.addRow([
      null,
      `Section total — ${section}`,
      null,
      null,
      null,
      { formula: `SUM(F${start}:F${sheet.rowCount})`, result: subtotal },
      section,
    ]);
    sectionRows.push(row.number);
    start = row.number + 1;
    subtotal = 0;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trade !== section) {
      total();
      section = line.trade;
    }
    const row = sheet.rowCount + 1;
    const rate =
      version === 2 && [80, 150].includes(i)
        ? Math.round(line.rate * 1.05 * 100) / 100
        : line.rate;
    const amount = line.quantity * rate;
    sheet.addRow([
      line.ref,
      line.description,
      line.unit,
      line.quantity,
      rate,
      { formula: `D${row}*E${row}`, result: amount },
      line.trade,
      line.materialId || null,
    ]);
    subtotal += amount;
  }
  total();
  if (version === 2) {
    sheet.getCell("F30").value = {
      formula: "#REF!*E30",
      result: { error: "#REF!" },
    };
    const q = Number(sheet.getCell("D40").value),
      r = Number(sheet.getCell("E40").value);
    sheet.getCell("F40").value = {
      formula: "D40*E40+500",
      result: q * r + 500,
    };
    sheet.getCell("A50").value = sheet.getCell("A49").value;
    const subtotalCell = sheet.getCell(`F${sectionRows[0]}`);
    const old = subtotalCell.value as ExcelJS.CellFormulaValue;
    subtotalCell.value = {
      formula: `${old.formula}+1000`,
      result: Number(old.result) + 1000,
    };
    for (const [i, delta] of [4.2, 20, 100].entries()) {
      const line = lines[i];
      const row = sheet.rowCount + 1;
      sheet.addRow([
        `VE-007-${i + 1}`,
        `${line.description} — VE-007`,
        line.unit,
        delta,
        line.rate,
        { formula: `D${row}*E${row}`, result: delta * line.rate },
        line.trade,
        line.materialId,
      ]);
    }
  }
  sheet.columns.forEach((column, i) => {
    column.width = [16, 48, 12, 14, 14, 18, 24, 16][i];
  });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (let r = 2; r <= sheet.rowCount; r++)
    for (const c of [4, 5, 6]) sheet.getCell(r, c).numFmt = "#,##0.00";
  workbook.calcProperties.fullCalcOnLoad = true;
  const bytes = normalizeZipDates(await workbook.xlsx.writeBuffer());
  const path = `workbooks/boq-v${version}.xlsx`;
  await mkdir("public/mock-files/workbooks", { recursive: true });
  await writeFile(`public/mock-files/${path}`, Buffer.from(bytes));
  parsed[`boq-v${version}`] = await parseWorkbook(
    new Uint8Array(bytes).buffer,
    `WV-${version}`,
  );
  manifest[`boq-v${version}`] = {
    path,
    sha256: createHash("sha256").update(Buffer.from(bytes)).digest("hex"),
    sizeBytes: bytes.byteLength,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentBase64: Buffer.from(bytes).toString("base64"),
  };
}
await writeFile(
  "src/mocks/fixtures/workbook-files.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Generated two workbooks with formulas, 600 base items and seeded v2 checks.",
);

await writeFile(
  "src/mocks/fixtures/workbook-data.json",
  JSON.stringify(parsed) + "\n",
);

// XLSX ZIP entries otherwise carry wall-clock timestamps despite fixed workbook metadata.
function normalizeZipDates(bytes: ArrayBuffer) {
  const result = Buffer.from(bytes);
  let end = result.length - 22;
  while (end >= 0 && result.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Missing ZIP central directory");
  let offset = result.readUInt32LE(end + 16);
  const count = result.readUInt16LE(end + 10);
  const date = ((2026 - 1980) << 9) | (11 << 5) | 1;
  for (let i = 0; i < count; i++) {
    if (result.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Invalid ZIP directory entry");
    result.writeUInt16LE(0, offset + 12);
    result.writeUInt16LE(date, offset + 14);
    const local = result.readUInt32LE(offset + 42);
    result.writeUInt16LE(0, local + 10);
    result.writeUInt16LE(date, local + 12);
    offset +=
      46 +
      result.readUInt16LE(offset + 28) +
      result.readUInt16LE(offset + 30) +
      result.readUInt16LE(offset + 32);
  }
  return result;
}
