"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronRight,
  ClipboardList,
  GitCompareArrows,
  MapPin,
  Table2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge, Skeleton, ErrorState, EmptyState } from "@/components/ui";
import { AuditTimeline } from "@/features/audit";
import { queryKeys } from "@/lib/api";
import {
  formatCurrency,
  formatRange,
  formatPeriod,
  type FormatLocale,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { loadOverview, summarizeOverview } from "../load";
import { KpiCard } from "./kpi-card";

type AttentionKind = "conflict" | "change" | "variation" | "check" | "rising";

const attentionMeta: Record<AttentionKind, { icon: LucideIcon; tone: string }> =
  {
    conflict: { icon: AlertTriangle, tone: "text-risk bg-risk-bg" },
    change: { icon: GitCompareArrows, tone: "text-caution bg-caution-bg" },
    variation: { icon: ClipboardList, tone: "text-muted-ink bg-stone-50" },
    check: { icon: Table2, tone: "text-risk bg-risk-bg" },
    rising: { icon: TrendingUp, tone: "text-caution bg-caution-bg" },
  };

export function OverviewPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Overview");
  const projectsT = useTranslations("Projects");
  const locale = useLocale() as FormatLocale;
  const query = useQuery({
    queryKey: [...queryKeys.overview(projectId), "workspace"],
    queryFn: () => loadOverview(projectId),
    refetchInterval: 30000,
  });
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError)
    return (
      <ErrorState
        message={t("error")}
        action={{
          label: t("retry"),
          onClick: () => {
            void query.refetch();
          },
        }}
      />
    );
  const d = query.data;
  const month = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Hong_Kong",
  })
    .format(new Date())
    .replace("/", "-");
  const s = summarizeOverview(d, month);
  const root = `/projects/${projectId}`;
  const attention: {
    id: string;
    kind: AttentionKind;
    text: string;
    href: string;
  }[] = [
    ...s.conflicts.map((v) => ({
      id: `doc:${v.id}`,
      kind: "conflict" as const,
      text: t("conflict", { ref: v.docNumber }),
      href: `${root}/documents/${v.id}`,
    })),
    ...s.unreviewed.map((v) => ({
      id: `change:${v.id}`,
      kind: "change" as const,
      text: t("change", { number: v.number }),
      href: `${root}/drawings/compare/${v.comparisonId}?change=${encodeURIComponent(v.id)}`,
    })),
    ...s.potential.map((v) => ({
      id: v.id,
      kind: "variation" as const,
      text: t("variation", { ref: v.ref }),
      href: `${root}/variations/${v.id}`,
    })),
    ...d.checks.flatMap((w) =>
      w.checks
        .filter((c) => c.status === "open" && c.severity === "error")
        .map((c) => ({
          id: c.id,
          kind: "check" as const,
          text: `${w.workbook.name} · ${c.cell}: ${c.message}`,
          href: `${root}/workbooks/${w.workbook.id}?detail=check:${encodeURIComponent(c.id)}`,
        })),
    ),
    ...s.rising.map((m) => ({
      id: m.id,
      kind: "rising" as const,
      text: t("rising", { name: m.name }),
      href: `/materials/${m.id}?project=${projectId}`,
    })),
  ];
  return (
    <div className="space-y-6 tabular-nums">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">{d.project.name}</h1>
          <Badge className="num">{d.project.code}</Badge>
        </div>
        <p className="mt-2 text-muted-ink">{t("title")}</p>
        {(d.project.location || d.project.buildingType) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-ink">
            {d.project.location && (
              <span className="flex items-center gap-1.5">
                <MapPin
                  size={14}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="shrink-0"
                />
                {d.project.location}
              </span>
            )}
            {d.project.buildingType && (
              <span className="flex items-center gap-1.5">
                <Building2
                  size={14}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="shrink-0"
                />
                {projectsT(`buildingTypes.${d.project.buildingType}`)}
              </span>
            )}
          </div>
        )}
      </header>
      {/* KPI tiles: compact numbers up top; the detailed context moved into
          each card's hover/focus tooltip and the whole tile navigates. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("documents")}
          value={d.documents.length}
          detail={t("conflicts", { count: s.conflicts.length })}
          href={`${root}/documents`}
        />
        <KpiCard
          label={t("drawings")}
          value={s.comparisons}
          detail={t("comparisons", {
            period: formatPeriod(month, locale),
            count: s.unreviewed.length,
          })}
          href={`${root}/drawings`}
        />
        <KpiCard
          label={t("variations")}
          value={s.potential.length}
          detail={[
            t("potentialRange", {
              range: s.priced ? formatRange(s.low, s.high) : t("unpriced"),
              priced: s.priced,
              count: s.potential.length,
            }),
            t("confirmed", {
              total: s.confirmedPriced
                ? `${formatCurrency(s.confirmed)} (${formatRange(s.confirmedLow, s.confirmedHigh)})`
                : t("unpriced"),
            }),
            t("costBasis"),
          ].join("\n")}
          href={`${root}/variations`}
        />
        <KpiCard
          label={t("workbooks")}
          value={s.errors}
          detail={t("checks", { count: s.warnings })}
          href={`${root}/workbooks`}
        />
      </div>
      <section className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{t("attention")}</h2>
          {attention.length > 0 && (
            <span className="num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-risk-bg px-2 text-xs font-semibold text-risk">
              {attention.length}
            </span>
          )}
        </div>
        {attention.length ? (
          <ul className="divide-y divide-line">
            {attention.map((a) => {
              const meta = attentionMeta[a.kind];
              const Icon = meta.icon;
              return (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay-600"
                  >
                    <span
                      className={cn(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
                        meta.tone,
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink">
                      {a.text}
                    </span>
                    <ChevronRight
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="shrink-0 text-muted-ink opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-6">
            <EmptyState message={t("clear")} />
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{t("recent")}</h2>
          <Link
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-clay-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            href={`${root}/audit`}
          >
            {t("showAllActivity")}
            <ArrowRight
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="shrink-0"
            />
          </Link>
        </div>
        <div className="px-5 py-4">
          {d.events.length ? (
            <AuditTimeline events={d.events} projectId={projectId} />
          ) : (
            <EmptyState message={t("emptyActivity")} />
          )}
        </div>
      </section>
    </div>
  );
}
