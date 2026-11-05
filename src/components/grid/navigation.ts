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
