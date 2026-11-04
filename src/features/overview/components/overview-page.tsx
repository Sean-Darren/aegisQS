"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SummaryCard, Skeleton, ErrorState, EmptyState } from "@/components/ui";
import { AuditTimeline } from "@/features/audit";
import { queryKeys } from "@/lib/api";
import {
  formatCurrency,
  formatRange,
  formatPeriod,
  type FormatLocale,
} from "@/lib/format";
import { loadOverview, summarizeOverview } from "../load";
const link =
  "rounded-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600";
export function OverviewPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Overview");
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
  const attention = [
    ...s.conflicts.map((v) => ({
      id: `doc:${v.id}`,
      text: t("conflict", { ref: v.docNumber }),
      href: `${root}/documents/${v.id}`,
    })),
    ...s.unreviewed.map((v) => ({
      id: `change:${v.id}`,
      text: t("change", { number: v.number }),
      href: `${root}/drawings/compare/${v.comparisonId}?change=${encodeURIComponent(v.id)}`,
    })),
    ...s.potential.map((v) => ({
      id: v.id,
      text: t("variation", { ref: v.ref }),
      href: `${root}/variations/${v.id}`,
    })),
    ...d.checks.flatMap((w) =>
      w.checks
        .filter((c) => c.status === "open" && c.severity === "error")
        .map((c) => ({
          id: c.id,
          text: `${w.workbook.name} · ${c.cell}: ${c.message}`,
          href: `${root}/workbooks/${w.workbook.id}?detail=check:${encodeURIComponent(c.id)}`,
        })),
    ),
    ...s.rising.map((m) => ({
      id: m.id,
      text: t("rising", { name: m.name }),
      href: `/materials/${m.id}?project=${projectId}`,
    })),
  ];
  return (
    <div className="space-y-6 tabular-nums">
      <header>
        <h1 className="text-2xl font-semibold">{d.project.name}</h1>
        <p className="mt-2 text-muted-ink">{t("title")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t("documents")}
          value={d.documents.length}
          context={t("conflicts", { count: s.conflicts.length })}
        >
          <Link className={link} href={`${root}/documents`}>
            {t("openDocuments")}
          </Link>
        </SummaryCard>
        <SummaryCard
          label={t("drawings")}
          value={s.comparisons}
          context={t("comparisons", {
            period: formatPeriod(month, locale),
            count: s.unreviewed.length,
          })}
        >
          <Link className={link} href={`${root}/drawings`}>
            {t("openDrawings")}
          </Link>
        </SummaryCard>
        <SummaryCard
          label={t("variations")}
          value={s.potential.length}
          context={t("potentialRange", {
            range: s.priced ? formatRange(s.low, s.high) : t("unpriced"),
            priced: s.priced,
            count: s.potential.length,
          })}
        >
          <p className="my-2 text-sm">
            {t("confirmed", {
              total: s.confirmedPriced
                ? `${formatCurrency(s.confirmed)} (${formatRange(s.confirmedLow, s.confirmedHigh)})`
                : t("unpriced"),
            })}
          </p>
          <p className="text-xs text-muted-ink">{t("costBasis")}</p>
          <Link className={link} href={`${root}/variations`}>
            {t("openVariations")}
          </Link>
        </SummaryCard>
        <SummaryCard
          label={t("workbooks")}
          value={s.errors}
          context={t("checks", { count: s.warnings })}
        >
          <Link className={link} href={`${root}/workbooks`}>
            {t("openWorkbooks")}
          </Link>
        </SummaryCard>
      </div>
      <section className="space-y-3 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">{t("attention")}</h2>
        {attention.length ? (
          <ul className="divide-y divide-line">
            {attention.map((a) => (
              <li key={a.id} className="py-3">
                <Link className={link} href={a.href}>
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message={t("clear")} />
        )}
      </section>
      <section className="space-y-3 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">{t("recent")}</h2>
        {d.events.length ? (
          <AuditTimeline events={d.events.slice(0, 15)} projectId={projectId} />
        ) : (
          <EmptyState message={t("emptyActivity")} />
        )}
        <Link className={link} href={`${root}/audit`}>
          {t("allActivity")}
        </Link>
      </section>
    </div>
  );
}
