"use client";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode } from "react";
export function VirtualTable<T>({
  rows,
  renderRow,
  label,
  rowHeight = 36,
  header,
  columns,
  onRowClick,
  autoHeight = false,
}: {
  rows: T[];
  renderRow: (row: T, index: number) => ReactNode;
  label: string;
  rowHeight?: number;
  header?: ReactNode;
  columns?: string;
  onRowClick?: (row: T) => void;
  /** Expand to the full height of the content instead of a fixed
      scrollable viewport. */
  autoHeight?: boolean;
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
      tabIndex={0}
      aria-label={label}
      aria-rowcount={rows.length + (header ? 1 : 0)}
      className={`tabular-nums focus-visible:outline-2 focus-visible:outline-clay-600${autoHeight ? "" : " overflow-auto"}`}
      style={autoHeight ? undefined : { height: 480 }}
    >
      {header && (
        <div
          role="row"
          className={`bg-stone-50${autoHeight ? "" : " sticky top-0 z-10"}`}
          style={{
            display: "grid",
            gridTemplateColumns: columns,
            minWidth: columns ? 1000 : undefined,
          }}
        >
          {header}
        </div>
      )}
      <div
        role="rowgroup"
        style={{
          height: virtual.getTotalSize(),
          position: "relative",
          minWidth: columns ? 1000 : undefined,
        }}
      >
        {virtual.getVirtualItems().map((item) => (
          <div
            role="row"
            aria-rowindex={item.index + (header ? 2 : 1)}
            key={item.key}
            className={onRowClick ? "cursor-pointer" : undefined}
            onClick={(event) => {
              if (
                !(event.target as HTMLElement).closest(
                  "a,button,input,select,textarea",
                )
              )
                onRowClick?.(rows[item.index]);
            }}
            style={{
              display: columns ? "grid" : undefined,
              gridTemplateColumns: columns,
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
