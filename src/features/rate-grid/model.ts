import type { RateGridRow, Tenderer } from "@/schemas";

export type HeatLevel = "insufficient" | "neutral" | "caution" | "risk";
export function heatLevel(row: RateGridRow, zScore?: number): HeatLevel {
  if (!row.benchmarkSufficient) return "insufficient";
  if (zScore === undefined) return "neutral";
  const magnitude = Math.abs(zScore);
  return magnitude >= 2 ? "risk" : magnitude >= 1 ? "caution" : "neutral";
}

export type GridCell = { row: number; column: number };
export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
export function moveGridCell(
  current: GridCell,
  key: ArrowKey,
  rowCount: number,
  columnCount: number,
): GridCell {
  const rowDelta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  const columnDelta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  return {
    row: Math.max(0, Math.min(rowCount - 1, current.row + rowDelta)),
    column: Math.max(
      0,
      Math.min(columnCount - 1, current.column + columnDelta),
    ),
  };
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
export function gridCsv(
  rows: RateGridRow[],
  tenderers: Tenderer[],
  labels: {
    itemRef: string;
    description: string;
    trade: string;
    unit: string;
    quantity: string;
    benchmark: string;
    rate: string;
    sigma: string;
    insufficient: string;
  },
) {
  const header = [
    labels.itemRef,
    labels.description,
    labels.trade,
    labels.unit,
    labels.quantity,
    labels.benchmark,
    ...tenderers.flatMap((tenderer) => [
      `${tenderer.name} — ${labels.rate}`,
      `${tenderer.name} — ${labels.sigma}`,
    ]),
  ];
  const lines = rows.map((row) => [
    row.boqItemRef,
    row.description,
    row.trade,
    row.unit,
    row.quantity,
    row.benchmarkSufficient ? row.benchmarkRate : labels.insufficient,
    ...tenderers.flatMap((tenderer) => {
      const rate = row.rates[tenderer.id];
      return [
        rate?.rate ?? null,
        row.benchmarkSufficient ? rate?.zScore : null,
      ];
    }),
  ]);
  return `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
}
