"use client";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  columnSizingFeature,
  flexRender,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CircleDashed, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from "@/components/ui";
import { resources } from "@/lib/api";
import {
  formatNumber,
  formatSigma,
  formatUnitRate,
  type FormatLocale,
} from "@/lib/format";
import type { RateGridRow } from "@/schemas";
import { useRateGridData } from "../api";
import {
  gridCsv,
  heatLevel,
  moveGridCell,
  type ArrowKey,
  type GridCell,
} from "../model";

const fixedWidths = {
  boqItemRef: 104,
  description: 248,
  trade: 138,
  unit: 72,
  quantity: 100,
  benchmarkRate: 194,
} as const;
const fixedIds = Object.keys(fixedWidths);
const fixedLeft = Object.fromEntries(
  fixedIds.map((id, index) => [
    id,
    fixedIds
      .slice(0, index)
      .reduce(
        (sum, preceding) =>
          sum + fixedWidths[preceding as keyof typeof fixedWidths],
        0,
      ),
  ]),
) as Record<string, number>;
const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
const features = tableFeatures({ columnSizingFeature });

const RateValueCell = memo(function RateValueCell({
  row,
  tendererId,
  kind,
  insufficient,
  noRate,
  onEvidence,
}: {
  row: RateGridRow;
  tendererId: string;
  kind: "rate" | "sigma";
  insufficient: string;
  noRate: string;
  onEvidence: (flagId: string) => void;
}) {
  const value = row.rates[tendererId];
  const heat = heatLevel(row, value?.zScore);
  const label =
    kind === "rate"
      ? value?.rate == null
        ? noRate
        : formatUnitRate(value.rate, row.unit)
      : heat === "insufficient"
        ? insufficient
        : value?.zScore === undefined
          ? noRate
          : formatSigma(value.zScore);
  const heatClass =
    kind !== "sigma" || heat === "insufficient" || heat === "neutral"
      ? ""
      : heat === "caution"
        ? "bg-caution-bg text-caution"
        : "bg-risk-bg text-risk";
  const content = value?.flagId ? (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => onEvidence(value.flagId!)}
      className="num w-full rounded-sm text-right underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
    >
      {label}
    </button>
  ) : (
    <span>{label}</span>
  );
  return (
    <span
      className={`num block min-h-7 px-2 py-1 text-right ${heatClass}`}
      title={heat === "insufficient" ? insufficient : undefined}
    >
      {content}
    </span>
  );
});

export function RateGrid({ projectId }: { projectId: string }) {
  const t = useTranslations("RateGrid");
  const common = useTranslations("Common");
  const locale = useLocale() as FormatLocale;
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [trade, setTrade] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const [density, setDensity] = useState<"comfortable" | "compact">("compact");
  const [knownTrades, setKnownTrades] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [active, setActive] = useState<GridCell>({ row: 0, column: 0 });
  const pendingFocus = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const filters = useMemo(
    () => ({ trade: trade || undefined, flaggedOnly }),
    [trade, flaggedOnly],
  );
  const { tenderers, grid } = useRateGridData(projectId, filters);
  const rows = useMemo(
    () => grid.data?.pages.flatMap((page) => page.rows) ?? [],
    [grid.data],
  );
  const totalRows = grid.data?.pages[0]?.totalRows ?? 0;
  const visibleTenderers = useMemo(
    () =>
      (tenderers.data ?? []).filter(
        (tenderer) => visibleIds === null || visibleIds.includes(tenderer.id),
      ),
    [tenderers.data, visibleIds],
  );
  useEffect(() => {
    const found = grid.data?.pages[0]?.rows.map((row) => row.trade) ?? [];
    if (found.length) {
      setKnownTrades((previous) => {
        const next = Array.from(new Set([...previous, ...found])).sort();
        return next.length === previous.length ? previous : next;
      });
    }
  }, [grid.data]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
    setActive({ row: 0, column: 0 });
  }, [trade, flaggedOnly]);
  const openEvidence = useCallback(
    (flagId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("evidence", flagId);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  const columns = useMemo<ColumnDef<typeof features, RateGridRow>[]>(
    () => [
      {
        id: "boqItemRef",
        accessorKey: "boqItemRef",
        header: t("itemRef"),
        size: fixedWidths.boqItemRef,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.boqItemRef}</span>
        ),
      },
      {
        id: "description",
        accessorKey: "description",
        header: t("descriptionColumn"),
        size: fixedWidths.description,
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.description}>
            {row.original.description}
          </span>
        ),
      },
      {
        id: "trade",
        accessorKey: "trade",
        header: t("trade"),
        size: fixedWidths.trade,
        cell: ({ row }) => row.original.trade,
      },
      {
        id: "unit",
        accessorKey: "unit",
        header: t("unit"),
        size: fixedWidths.unit,
        cell: ({ row }) => row.original.unit,
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        header: t("quantity"),
        size: fixedWidths.quantity,
        cell: ({ row }) => formatNumber(row.original.quantity, locale),
      },
      {
        id: "benchmarkRate",
        accessorKey: "benchmarkRate",
        header: t("benchmarkRate"),
        size: fixedWidths.benchmarkRate,
        cell: ({ row }) =>
          row.original.benchmarkSufficient &&
          row.original.benchmarkRate !== undefined ? (
            formatUnitRate(row.original.benchmarkRate, row.original.unit)
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-ink">
              <CircleDashed size={14} aria-hidden="true" />
              {t("insufficient")}
            </span>
          ),
      },
      ...visibleTenderers.map(
        (tenderer): ColumnDef<typeof features, RateGridRow> => ({
          id: `tenderer:${tenderer.id}`,
          header: tenderer.name,
          columns: [
            {
              id: `rate:${tenderer.id}`,
              header: t("rate"),
              size: 190,
              cell: ({ row }) => (
                <RateValueCell
                  row={row.original}
                  tendererId={tenderer.id}
                  kind="rate"
                  insufficient={t("insufficient")}
                  noRate={t("noRate")}
                  onEvidence={openEvidence}
                />
              ),
            },
            {
              id: `sigma:${tenderer.id}`,
              header: t("zScore"),
              size: 112,
              cell: ({ row }) => (
                <RateValueCell
                  row={row.original}
                  tendererId={tenderer.id}
                  kind="sigma"
                  insufficient={t("insufficientShort")}
                  noRate={t("noRate")}
                  onEvidence={openEvidence}
                />
              ),
            },
          ],
        }),
      ),
    ],
    [locale, openEvidence, t, visibleTenderers],
  );
  const table = useTable({ features, data: rows, columns });
  const tableRows = table.getRowModel().rows;
  const leafColumns = table.getAllLeafColumns();
  // TanStack Virtual returns an imperative virtualizer that React Compiler does not memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (density === "compact" ? 36 : 44),
    overscan: 8,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = virtualRows.length
    ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;
  useEffect(() => {
    if (!pendingFocus.current) return;
    const cell = scrollRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${active.row}"][data-grid-column="${active.column}"]`,
    );
    if (cell) {
      cell.focus({ preventScroll: true });
      cell.scrollIntoView({ block: "nearest", inline: "nearest" });
      pendingFocus.current = false;
    }
  }, [active, virtualRows]);
  const loadMore = useCallback(() => {
    const el = scrollRef.current;
    if (
      el &&
      grid.hasNextPage &&
      !grid.isFetchingNextPage &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 500
    ) {
      void grid.fetchNextPage();
    }
  }, [grid]);
  function onGridKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>(
      "[data-grid-row][data-grid-column]",
    );
    if (!cell) return;
    const current = {
      row: Number(cell.dataset.gridRow),
      column: Number(cell.dataset.gridColumn),
    };
    if (arrowKeys.has(event.key)) {
      event.preventDefault();
      if (
        event.key === "ArrowDown" &&
        current.row === tableRows.length - 1 &&
        grid.hasNextPage &&
        !grid.isFetchingNextPage
      ) {
        pendingFocus.current = true;
        void grid.fetchNextPage().then(() => {
          const next = { row: current.row + 1, column: current.column };
          setActive(next);
          virtualizer.scrollToIndex(next.row);
        });
        return;
      }
      const next = moveGridCell(
        current,
        event.key as ArrowKey,
        tableRows.length,
        leafColumns.length,
      );
      pendingFocus.current = true;
      setActive(next);
      virtualizer.scrollToIndex(next.row);
    } else if (event.key === "Enter") {
      const column = leafColumns[current.column];
      const tendererId = column?.id.split(":")[1];
      const flagId = tendererId
        ? tableRows[current.row]?.original.rates[tendererId]?.flagId
        : undefined;
      if (flagId) {
        event.preventDefault();
        openEvidence(flagId);
      }
    }
  }
  function toggleTenderer(id: string) {
    const all = tenderers.data?.map((item) => item.id) ?? [];
    const current = visibleIds ?? all;
    setVisibleIds(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  async function exportView() {
    setExportError(false);
    setExporting(true);
    try {
      const all: RateGridRow[] = [];
      let cursor: string | undefined;
      do {
        const page = await resources.rateGrid(projectId, {
          ...filters,
          cursor,
        });
        all.push(...page.rows);
        cursor = page.nextCursor;
      } while (cursor);
      const csv = gridCsv(all, visibleTenderers, {
        itemRef: t("itemRef"),
        description: t("descriptionColumn"),
        trade: t("trade"),
        unit: t("unit"),
        quantity: t("quantity"),
        benchmark: t("benchmarkRate"),
        rate: t("rate"),
        sigma: t("zScore"),
        insufficient: t("insufficient"),
      });
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectId}-rates.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t("exported"), "success");
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }
  if (tenderers.isPending || grid.isPending) {
    return (
      <section aria-label={common("loading")} className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[560px] w-full" />
      </section>
    );
  }
  if (tenderers.isError || grid.isError) {
    return (
      <ErrorState
        message={t("loadError")}
        action={{
          label: common("retry"),
          onClick: () => {
            void tenderers.refetch();
            void grid.refetch();
          },
        }}
      />
    );
  }
  const headerGroups = table.getHeaderGroups();
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-ink">{t("description")}</p>
      </header>
      <section
        aria-label={t("filters")}
        className="rounded-lg border border-line bg-panel p-4"
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-[13px] font-medium">
            {t("tradeFilter")}
            <select
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
              className="mt-1 block h-9 min-w-44 rounded-md border border-line-strong bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            >
              <option value="">{t("allTrades")}</option>
              {knownTrades.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(event) => setFlaggedOnly(event.target.checked)}
              className="size-4 accent-clay-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            />
            {t("flaggedOnly")}
          </label>
          <details className="relative">
            <summary className="flex h-9 cursor-pointer items-center rounded-md border border-line-strong bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600">
              {t("tendererColumns", { count: visibleTenderers.length })}
            </summary>
            <div className="floating-layer absolute left-0 top-10 z-30 max-h-80 min-w-64 overflow-y-auto rounded-md border border-line bg-panel p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleIds(null)}
              >
                {t("showAllTenderers")}
              </Button>
              <div className="mt-2 space-y-1">
                {(tenderers.data ?? []).map((tenderer) => (
                  <label
                    key={tenderer.id}
                    className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={
                        visibleIds === null || visibleIds.includes(tenderer.id)
                      }
                      onChange={() => toggleTenderer(tenderer.id)}
                      className="size-4 accent-clay-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                    />
                    {tenderer.name}
                  </label>
                ))}
              </div>
            </div>
          </details>
          <div role="group" aria-label={t("density")} className="flex gap-1">
            {(["compact", "comfortable"] as const).map((value) => (
              <Button
                key={value}
                variant={density === value ? "secondary" : "outline"}
                size="sm"
                aria-pressed={density === value}
                onClick={() => setDensity(value)}
              >
                {t(value)}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting || totalRows === 0}
            onClick={() => void exportView()}
          >
            <Download size={16} aria-hidden="true" />
            {exporting ? t("exporting") : t("exportCsv")}
          </Button>
        </div>
        {exportError && (
          <p role="alert" className="mt-2 text-sm text-risk">
            {t("exportError")}
          </p>
        )}
      </section>
      {totalRows === 0 ? (
        <EmptyState message={t(trade || flaggedOnly ? "noMatches" : "empty")} />
      ) : (
        <section
          aria-label={t("gridSection")}
          className="rounded-lg border border-line bg-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-xs text-muted-ink">
            <p className="num">
              {t("rowCount", {
                loaded: formatNumber(rows.length, locale),
                total: formatNumber(totalRows, locale),
              })}
            </p>
            <p>{t("keyboardHint")}</p>
          </div>
          <div
            ref={scrollRef}
            onScroll={loadMore}
            className="max-h-[min(70vh,680px)] overflow-auto"
          >
            <table
              role="grid"
              aria-label={t("gridLabel")}
              aria-rowcount={totalRows + headerGroups.length}
              aria-colcount={leafColumns.length}
              onKeyDown={onGridKeyDown}
              className="num border-separate border-spacing-0 text-sm"
              style={{ width: table.getTotalSize(), tableLayout: "fixed" }}
            >
              <colgroup>
                {leafColumns.map((column) => (
                  <col key={column.id} style={{ width: column.getSize() }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20 bg-stone-50 text-[13px] font-medium text-muted-ink">
                {headerGroups.map((group, groupIndex) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const isFixed = header.column.id in fixedLeft;
                      if (header.isPlaceholder && !isFixed) return null;
                      if (isFixed && groupIndex > 0) return null;
                      const isNumeric =
                        header.column.id === "quantity" ||
                        header.column.id === "benchmarkRate" ||
                        header.column.id.startsWith("rate:") ||
                        header.column.id.startsWith("sigma:");
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          colSpan={header.colSpan}
                          rowSpan={isFixed ? headerGroups.length : 1}
                          className={`border-b border-r border-line bg-stone-50 px-3 py-2 font-medium ${isNumeric ? "text-right" : "text-left"} ${isFixed ? "sticky z-30" : ""} ${header.column.id === "benchmarkRate" ? "border-r-line-strong" : ""}`}
                          style={
                            isFixed
                              ? {
                                  left: fixedLeft[header.column.id],
                                  width: header.column.getSize(),
                                }
                              : undefined
                          }
                        >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={leafColumns.length}
                      style={{ height: paddingTop, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = tableRows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      aria-rowindex={virtualRow.index + headerGroups.length + 1}
                      className="bg-panel hover:bg-stone-50"
                      style={{ height: virtualRow.size }}
                    >
                      {row.getAllCells().map((cell, columnIndex) => {
                        const isFixed = cell.column.id in fixedLeft;
                        const isNumeric =
                          cell.column.id === "quantity" ||
                          cell.column.id === "benchmarkRate" ||
                          cell.column.id.startsWith("rate:") ||
                          cell.column.id.startsWith("sigma:");
                        return (
                          <td
                            key={cell.id}
                            role="gridcell"
                            data-grid-row={virtualRow.index}
                            data-grid-column={columnIndex}
                            tabIndex={
                              active.row === virtualRow.index &&
                              active.column === columnIndex
                                ? 0
                                : -1
                            }
                            onFocus={() =>
                              setActive({
                                row: virtualRow.index,
                                column: columnIndex,
                              })
                            }
                            onClick={(event) => {
                              if (event.target === event.currentTarget)
                                event.currentTarget.focus();
                            }}
                            className={`border-b border-r border-line px-2 py-0 outline-none focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-clay-600 ${isNumeric ? "text-right" : "text-left"} ${isFixed ? "sticky z-10 bg-panel" : ""} ${cell.column.id === "benchmarkRate" ? "border-r-line-strong" : ""}`}
                            style={
                              isFixed
                                ? {
                                    left: fixedLeft[cell.column.id],
                                    width: cell.column.getSize(),
                                  }
                                : undefined
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={leafColumns.length}
                      style={{ height: paddingBottom, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {grid.isFetchingNextPage && (
            <p aria-live="polite" className="px-4 py-2 text-sm text-muted-ink">
              {t("loadingMore")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
