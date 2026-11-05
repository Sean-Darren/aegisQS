"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { moveGridCell, type ArrowKey } from "./navigation";
import { IssueMarker } from "./issue-marker";
import type { SheetPreview, WorkbookCheck, ColumnMapping } from "@/schemas";
export function SheetGrid({
  rows,
  checks,
  mapping,
  labels,
  label,
  selectedCell,
  onOpen,
}: {
  rows: SheetPreview["rows"];
  checks: WorkbookCheck[];
  mapping?: ColumnMapping;
  labels: Record<string, string>;
  label: string;
  selectedCell?: string;
  onOpen: (check: WorkbookCheck) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const columns = useMemo(
    () =>
      [...new Set(rows.flatMap((r) => r.cells.map((c) => c.column)))].sort(
        (a, b) => a.length - b.length || a.localeCompare(b),
      ),
    [rows],
  );
  const [active, setActive] = useState({
    row: Math.max(
      0,
      rows.findIndex((r) => r.row === Number(selectedCell?.replace(/\D/g, ""))),
    ),
    column: Math.max(
      0,
      columns.indexOf(selectedCell?.replace(/\d/g, "") ?? ""),
    ),
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => root.current,
    estimateSize: () => 36,
    overscan: 8,
  });
  useEffect(() => {
    if (!selectedCell) return;
    const row = rows.findIndex(
      (r) => r.row === Number(selectedCell.replace(/\D/g, "")),
    );
    const column = columns.indexOf(selectedCell.replace(/\d/g, ""));
    if (row < 0 || column < 0) return;
    virtual.scrollToIndex(row, { align: "center" });
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(`[data-grid-cell="${row}:${column}"]`)
        ?.focus(),
    );
  }, [selectedCell, rows, columns, virtual]); // column identities are derived from this window
  function navigate(key: ArrowKey) {
    const next = moveGridCell(active, key, rows.length, columns.length);
    setActive(next);
    virtual.scrollToIndex(next.row);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(
          `[data-grid-cell="${next.row}:${next.column}"]`,
        )
        ?.focus(),
    );
  }
  return (
    <div
      ref={root}
      role="grid"
      aria-label={label}
      aria-readonly="true"
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length + 1}
      tabIndex={0}
      className="relative h-[500px] overflow-auto border border-line bg-panel tabular-nums focus-visible:outline-2 focus-visible:outline-clay-600"
      onKeyDown={(e) => {
        if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          navigate(e.key as ArrowKey);
        }
      }}
    >
      <div
        role="row"
        className="sticky top-0 z-20 flex bg-stone-50"
        style={{ minWidth: 56 + columns.length * 160 }}
      >
        <div
          role="columnheader"
          className="sticky left-0 z-20 w-14 shrink-0 bg-stone-50"
        />
        {columns.map((c) => (
          <div
            role="columnheader"
            key={c}
            className="w-40 shrink-0 border-b border-r border-line p-1 text-center text-xs"
          >
            {c}
            <span className="block">
              {Object.entries(mapping?.columns ?? {})
                .filter(([, v]) => v === c)
                .map(([k]) => labels[k])
                .join(", ")}
            </span>
          </div>
        ))}
      </div>
      <div
        role="rowgroup"
        style={{
          height: virtual.getTotalSize(),
          position: "relative",
          minWidth: 56 + columns.length * 160,
        }}
      >
        {virtual.getVirtualItems().map((v) => {
          const row = rows[v.index];
          return (
            <div
              role="row"
              aria-rowindex={v.index + 2}
              key={row.row}
              className="absolute left-0 top-0 flex h-9 w-full"
              style={{ transform: `translateY(${v.start}px)` }}
            >
              <div
                role="rowheader"
                className="sticky left-0 z-10 w-14 shrink-0 border-b border-r border-line-strong bg-stone-50 p-2 text-right text-xs"
              >
                {row.row}
              </div>
              {columns.map((col, ci) => {
                const cell = row.cells.find((c) => c.column === col);
                const issues = checks.filter(
                  (c) => c.cell === `${col}${row.row}`,
                );
                return (
                  <div
                    role="gridcell"
                    aria-selected={
                      active.row === v.index && active.column === ci
                    }
                    key={col}
                    className={`relative w-40 shrink-0 border-b border-r border-line text-sm ${active.row === v.index && active.column === ci ? "bg-limewash-100 outline-2 -outline-offset-2 outline-clay-600" : ""}`}
                  >
                    <button
                      type="button"
                      data-grid-cell={`${v.index}:${ci}`}
                      tabIndex={
                        active.row === v.index && active.column === ci ? 0 : -1
                      }
                      className={`h-full w-full truncate px-2 focus-visible:outline-2 focus-visible:outline-clay-600 ${typeof cell?.value === "number" ? "text-right" : "text-left"}`}
                      title={
                        cell?.formula
                          ? `=${cell.formula}`
                          : String(cell?.value ?? "")
                      }
                      onFocus={() => setActive({ row: v.index, column: ci })}
                      onClick={() => setActive({ row: v.index, column: ci })}
                    >
                      {cell?.value ?? "—"}
                    </button>
                    {issues[0] && (
                      <IssueMarker
                        check={issues[0]}
                        onOpen={() => onOpen(issues[0])}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
