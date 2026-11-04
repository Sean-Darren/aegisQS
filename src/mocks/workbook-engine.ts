import { workbookThresholds } from "../lib/config/workbook.ts";
import type {
  BoqItem,
  ColumnMapping,
  WorkbookCheck,
  WorkbookDiff,
} from "@/schemas";
export const defaultMapping: ColumnMapping = {
  sheet: "BOQ",
  headerRow: 1,
  columns: {
    itemRef: "A",
    description: "B",
    unit: "C",
    quantity: "D",
    rate: "E",
    amount: "F",
    section: "G",
  },
};
export type SheetCell = {
  column: string;
  value: string | number | null;
  formula?: string;
};
export type SheetRow = { row: number; cells: SheetCell[] };
export interface ParsedWorkbook {
  sheetNames: string[];
  items: BoqItem[];
  checks: WorkbookCheck[];
  sheets: Record<string, SheetRow[]>;
  totals: { sheet: string; amount: number }[];
}
export async function parseWorkbook(
  bytes: ArrayBuffer,
  versionId: string,
  mapping: ColumnMapping = defaultMapping,
): Promise<ParsedWorkbook> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheet = book.getWorksheet(mapping.sheet);
  if (!sheet) throw new Error(`Mapped sheet ${mapping.sheet} does not exist.`);
  const checks: WorkbookCheck[] = [];
  const items: BoqItem[] = [];
  const sheets: Record<string, SheetRow[]> = {};
  const add = (
    rule: WorkbookCheck["rule"],
    cell: string,
    message: string,
    extra: Partial<WorkbookCheck> = {},
  ) =>
    checks.push({
      id: `${versionId}-check-${checks.length + 1}`,
      versionId,
      rule,
      severity: ["formula_error", "amount_mismatch", "sum_mismatch"].includes(
        rule,
      )
        ? "error"
        : "warning",
      sheet: sheet.name,
      cell,
      message,
      status: "open",
      ...extra,
    });
  function value(cell: import("exceljs").Cell): string | number | null {
    const v = cell.value;
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "boolean") return String(v);
    if ("error" in v) return v.error;
    if ("formula" in v || "sharedFormula" in v) {
      const result = v.result;
      if (typeof result === "string" || typeof result === "number")
        return result;
      if (result && typeof result === "object" && "error" in result)
        return result.error;
      return null;
    }
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
    return null;
  }
  for (const ws of book.worksheets) {
    const rows: SheetRow[] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: SheetCell[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push({
          column: cell.address.replace(/\d+$/, ""),
          value: value(cell),
          ...(cell.formula ? { formula: cell.formula } : {}),
        });
      });
      rows.push({ row: row.number, cells });
    });
    sheets[ws.name] = rows;
  }
  const c = mapping.columns;
  const numeric = (row: number, column: string) => {
    const v = value(sheet.getCell(`${column}${row}`));
    return typeof v === "number" ? v : null;
  };
  const refs = new Set<string>();
  const formulaErrors = new Set<string>();
  sheet.eachRow((row) => {
    if (row.number <= mapping.headerRow) return;
    row.eachCell((cell) => {
      const v = value(cell);
      const formula = cell.formula ?? "";
      if (
        (typeof v === "string" &&
          /^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!)/.test(v)) ||
        formula.includes("#REF!")
      ) {
        formulaErrors.add(cell.address);
        add(
          "formula_error",
          cell.address,
          `Formula error at ${cell.address}: ${String(v ?? formula)}. Check the formula in Excel.`,
        );
      }
      if (/\[[^\]]+\]/.test(formula))
        add(
          "external_link",
          cell.address,
          `Formula at ${cell.address} links to another workbook. Review its source.`,
        );
    });
    const ref = value(row.getCell(c.itemRef));
    if (ref === null || String(ref).trim() === "") return;
    const item: BoqItem = {
      id: `${versionId}-${sheet.name}-${row.number}`,
      workbookVersionId: versionId,
      sheet: sheet.name,
      row: row.number,
      itemRef: String(ref),
      description: String(value(row.getCell(c.description)) ?? ""),
      unit: String(value(row.getCell(c.unit)) ?? ""),
      quantity: numeric(row.number, c.quantity),
      rate: numeric(row.number, c.rate),
      amount: numeric(row.number, c.amount),
      ...(c.section
        ? { section: String(value(row.getCell(c.section)) ?? "") }
        : {}),
    };
    // Material identifiers are optional mock metadata, outside the mapped BOQ fields.
    const material =
      value(sheet.getCell(`H${mapping.headerRow}`)) === "Material"
        ? value(row.getCell("H"))
        : null;
    if (typeof material === "string" && material) item.materialId = material;
    items.push(item);
    for (const [key, rule] of [
      ["quantity", "missing_quantity"],
      ["rate", "missing_rate"],
      ["unit", "missing_unit"],
    ] as const)
      if (item[key] === null || item[key] === "")
        add(
          rule,
          `${c[key]}${row.number}`,
          `Item ${item.itemRef} has no ${key}. Check the mapping or the workbook.`,
          { itemRef: item.itemRef },
        );
    if (refs.has(item.itemRef))
      add(
        "duplicate_item_ref",
        `${c.itemRef}${row.number}`,
        `Item reference ${item.itemRef} is repeated. Review it in Excel.`,
        { itemRef: item.itemRef },
      );
    refs.add(item.itemRef);
    if (
      item.quantity !== null &&
      item.rate !== null &&
      item.amount !== null &&
      Math.abs(item.quantity * item.rate - item.amount) >
        workbookThresholds.amountToleranceHKD
    )
      add(
        "amount_mismatch",
        `${c.amount}${row.number}`,
        `Amount is HK$${item.amount.toLocaleString("en-HK")} but quantity × rate is HK$${(item.quantity * item.rate).toLocaleString("en-HK")}.`,
        {
          itemRef: item.itemRef,
          expected: String(item.quantity * item.rate),
          actual: String(item.amount),
        },
      );
    const amountCell = row.getCell(c.amount);
    if (
      typeof amountCell.value === "number" &&
      (sheet.getCell(`${c.amount}${row.number - 1}`).formula ||
        sheet.getCell(`${c.amount}${row.number + 1}`).formula)
    )
      add(
        "hardcoded_amount",
        amountCell.address,
        `Amount at ${amountCell.address} is typed rather than calculated. Check it in Excel.`,
        { itemRef: item.itemRef },
      );
  });
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      const formula = cell.formula;
      const match = formula?.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/i);
      if (!match || match[1] !== match[3]) return;
      let sum = 0;
      for (let r = Number(match[2]); r <= Number(match[4]); r++) {
        if (formulaErrors.has(`${match[1]}${r}`)) return;
        sum += numeric(r, match[1]) ?? 0;
      }
      const actual = value(cell);
      if (
        typeof actual === "number" &&
        Math.abs(actual - sum) > workbookThresholds.amountToleranceHKD
      )
        add(
          "sum_mismatch",
          cell.address,
          `Section total is HK$${actual.toLocaleString("en-HK")} but its lines sum to HK$${sum.toLocaleString("en-HK")}.`,
          { expected: String(sum), actual: String(actual) },
        );
    }),
  );
  for (const item of items) {
    if (item.rate === null) continue;
    const peers = items
      .filter(
        (p) =>
          p.section === item.section && p.unit === item.unit && p.rate !== null,
      )
      .map((p) => p.rate!)
      .sort((a, b) => a - b);
    if (peers.length < 3) continue;
    const mid = Math.floor(peers.length / 2);
    const median =
      peers.length % 2 ? peers[mid] : (peers[mid - 1] + peers[mid]) / 2;
    if (
      median > 0 &&
      Math.abs(item.rate / median - 1) > workbookThresholds.rateOutlierFraction
    )
      add(
        "rate_outlier",
        `${c.rate}${item.row}`,
        `Rate differs by more than ${workbookThresholds.rateOutlierFraction * 100}% from the median for this section and unit. Review its basis.`,
        { itemRef: item.itemRef },
      );
  }
  return {
    sheetNames: book.worksheets.map((ws) => ws.name),
    items,
    checks,
    sheets,
    totals: [
      {
        sheet: sheet.name,
        amount: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
      },
    ],
  };
}
export function summarizeChecks(checks: WorkbookCheck[]) {
  return {
    errors: checks.filter((c) => c.severity === "error").length,
    warnings: checks.filter((c) => c.severity === "warning").length,
    info: checks.filter((c) => c.severity === "info").length,
  };
}
export function diffWorkbooks(
  baseVersionId: string,
  targetVersionId: string,
  base: BoqItem[],
  target: BoqItem[],
): WorkbookDiff {
  const rows: WorkbookDiff["rows"] = [];
  const key = (i: BoqItem) => `${i.sheet}:${i.row}`;
  const before = new Map(base.map((i) => [key(i), i]));
  const after = new Map(target.map((i) => [key(i), i]));
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(k),
      b = after.get(k),
      item = (b ?? a)!;
    const fields: WorkbookDiff["rows"][number]["fields"] = [];
    for (const field of [
      "quantity",
      "rate",
      "amount",
      "description",
      "unit",
    ] as const) {
      const previous = a?.[field] ?? null,
        next = b?.[field] ?? null;
      if (previous !== next)
        fields.push({ field, before: previous, after: next });
    }
    if (fields.length || a?.itemRef !== b?.itemRef)
      rows.push({
        kind: !a ? "added" : !b ? "removed" : "changed",
        sheet: item.sheet,
        row: item.row,
        itemRef: item.itemRef,
        description: item.description,
        fields,
      });
  }
  return {
    baseVersionId,
    targetVersionId,
    summary: {
      added: rows.filter((r) => r.kind === "added").length,
      removed: rows.filter((r) => r.kind === "removed").length,
      changed: rows.filter((r) => r.kind === "changed").length,
      totalDelta:
        Math.round(
          (target.reduce((s, i) => s + (i.amount ?? 0), 0) -
            base.reduce((s, i) => s + (i.amount ?? 0), 0)) *
            100,
        ) / 100,
    },
    rows,
  };
}
