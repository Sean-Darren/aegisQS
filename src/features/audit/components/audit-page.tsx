"use client";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { resources } from "@/lib/api";
import { auditEventSchema } from "@/schemas";
import { useAuditEvents } from "../api";
import {
  auditEventsCsv,
  fetchAllAuditEvents,
  filterAuditEvents,
  initialAuditFilters,
  type AuditFilters,
} from "../model";
import { AuditTimeline } from "./audit-timeline";

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600";
const entityTypes = auditEventSchema.shape.entityType.options;

export function AuditPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Audit");
  const common = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useAuditEvents(projectId);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  const [filters, setFilters] = useState<AuditFilters>(initialAuditFilters);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const filtering = Object.values(filters).some(
    (value) => !!value && value !== "all",
  );
  const loaded = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );
  const visible = useMemo(
    () => filterAuditEvents(loaded, filters),
    [loaded, filters],
  );
  const collecting = filtering && query.hasNextPage;

  useEffect(() => {
    if (filtering && hasNextPage && !isFetchingNextPage && !isError) {
      void fetchNextPage();
    }
  }, [filtering, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  function update<K extends keyof AuditFilters>(
    key: K,
    value: AuditFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function openDetail(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("detail", id);
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  async function exportCsv() {
    setExporting(true);
    setExportError(false);
    try {
      const all = query.hasNextPage
        ? await fetchAllAuditEvents((cursor) =>
            resources.auditEvents(projectId, cursor),
          )
        : loaded;
      const rows = filterAuditEvents(all, filters);
      const csv = auditEventsCsv(rows, [
        t("csv.id"),
        t("csv.at"),
        t("csv.actorId"),
        t("csv.actorRole"),
        t("csv.action"),
        t("csv.entityType"),
        t("csv.entityId"),
        t("csv.summary"),
        t("csv.details"),
      ]);
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-${projectId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-ink">{t("description")}</p>
        </div>
        <Button
          variant="secondary"
          disabled={query.isPending || exporting}
          onClick={() => void exportCsv()}
        >
          <Download size={16} aria-hidden="true" />
          {exporting ? t("exporting") : t("exportCsv")}
        </Button>
      </header>
      <section
        aria-label={t("filters")}
        className="rounded-lg border border-line bg-panel p-5"
      >
        <h2 className="text-base font-semibold">{t("filters")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[13px] font-medium">
            {t("actor")}
            <input
              className={inputClass}
              value={filters.actor}
              onChange={(event) => update("actor", event.target.value)}
              placeholder={t("actorPlaceholder")}
            />
          </label>
          <label className="text-[13px] font-medium">
            {t("action")}
            <input
              className={inputClass}
              value={filters.action}
              onChange={(event) => update("action", event.target.value)}
              placeholder={t("actionPlaceholder")}
            />
          </label>
          <label className="text-[13px] font-medium">
            {t("entityType")}
            <select
              className={inputClass}
              value={filters.entityType}
              onChange={(event) =>
                update(
                  "entityType",
                  event.target.value as AuditFilters["entityType"],
                )
              }
            >
              <option value="all">{t("allEntityTypes")}</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`entities.${type}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            {t("fromDate")}
            <input
              type="date"
              className={inputClass}
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => update("from", event.target.value)}
            />
          </label>
          <label className="text-[13px] font-medium">
            {t("toDate")}
            <input
              type="date"
              className={inputClass}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => update("to", event.target.value)}
            />
          </label>
        </div>
        {filtering && visible.length > 0 && (
          <Button
            className="mt-4"
            variant="ghost"
            onClick={() => setFilters(initialAuditFilters)}
          >
            {t("clearFilters")}
          </Button>
        )}
      </section>
      {exportError && (
        <ErrorState
          message={t("exportError")}
          action={{ label: common("retry"), onClick: () => void exportCsv() }}
        />
      )}
      <section
        aria-label={t("timeline")}
        className="rounded-lg border border-line bg-panel p-5"
      >
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("timeline")}</h2>
          <p className="num text-xs text-muted-ink">
            {t("showing", { count: visible.length })}
          </p>
        </div>
        {query.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}
        {query.isError && !query.data ? (
          <ErrorState
            message={t("loadError")}
            action={{
              label: common("retry"),
              onClick: () => void query.refetch(),
            }}
          />
        ) : null}
        {collecting && !query.isError ? (
          <p role="status" className="mb-3 text-sm text-muted-ink">
            {t("searching")}
          </p>
        ) : null}
        {!query.isPending &&
        !query.isError &&
        !collecting &&
        visible.length === 0 ? (
          <EmptyState
            message={filtering ? t("noMatches") : t("empty")}
            action={
              filtering
                ? {
                    label: t("clearFilters"),
                    onClick: () => setFilters(initialAuditFilters),
                  }
                : undefined
            }
          />
        ) : null}
        {!query.isPending &&
        (!collecting || !filtering) &&
        visible.length > 0 ? (
          <AuditTimeline
            events={visible}
            projectId={projectId}
            onOpenDetail={openDetail}
          />
        ) : null}
        {query.isError && query.data ? (
          <ErrorState
            message={t("moreError")}
            action={{
              label: common("retry"),
              onClick: () => void query.fetchNextPage(),
            }}
          />
        ) : null}
        {!filtering && query.hasNextPage && !query.isError ? (
          <Button
            className="mt-4"
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? common("loading") : t("loadMore")}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
