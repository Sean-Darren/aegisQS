"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode } from "react";
export function VirtualTable<T>({
  rows,
  renderRow,
  label,
  rowHeight = 36,
}: {
  rows: T[];
  renderRow: (row: T, index: number) => ReactNode;
  label: string;
  rowHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // TanStack Virtual owns mutable measurements; React Compiler must skip this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  return (
    <div
      ref={ref}
      role="table"
      aria-label={label}
      aria-rowcount={rows.length}
      className="tabular-nums overflow-auto"
      style={{ height: 480 }}
    >
      <div
        role="rowgroup"
        style={{ height: virtual.getTotalSize(), position: "relative" }}
      >
        {virtual.getVirtualItems().map((item) => (
          <div
            role="row"
            aria-rowindex={item.index + 1}
            key={item.key}
            style={{
              position: "absolute",
              top: 0,
              width: "100%",
              height: item.size,
              transform: `translateY(${item.start}px)`,
            }}
          >
            {renderRow(rows[item.index], item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
