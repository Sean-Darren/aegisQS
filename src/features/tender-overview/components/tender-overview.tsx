"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, TriangleAlert } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  InsufficientDataState,
  Button,
  RiskBandBadge,
  Skeleton,
} from "@/components/ui";
import { useLatestProjectJob } from "@/lib/api";
import { riskBandFor } from "@/lib/config";
import {
  formatCompactCurrency,
  formatDate,
  formatSigma,
  type FormatLocale,
} from "@/lib/format";
import { rankTenderers } from "../model";
import { useTenderOverviewData } from "../api";
import type { RankedTenderer } from "../model";
import { ScoreDetailPanel } from "./score-detail-panel";

const PriceDistributionPlot = dynamic(
  () => import("./price-distribution-plot"),
  { ssr: false },
);

function VarianceSparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  if (!values.length) return null;
  const coordinates = values.map((value, index) => {
    const x = values.length === 1 ? 48 : (index / (values.length - 1)) * 96;
    const y = 24 - (Math.min(3, Math.abs(value)) / 3) * 20;
    return `${x},${y}`;
  });
  return (
    <svg className="h-7 w-24" viewBox="0 0 96 28" role="img" aria-label={label}>
      <polyline
        points={coordinates.join(" ")}
        fill="none"
        stroke="var(--clay-600)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function TendererCard({
  item,
  locale,
  onShowScore,
}: {
  item: RankedTenderer;
  locale: FormatLocale;
  onShowScore: (tendererId: string) => void;
}) {
  const t = useTranslations("TenderOverview");
  return (
    <article className="rounded-lg border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="num text-xs text-muted-ink">
            {t("rank", { rank: item.rank })}
          </p>
          <h3 className="mt-1 text-base font-semibold text-ink">
            {item.tenderer.name}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-2xl font-bold leading-none text-ink">
            {item.score.score.toFixed(1)}
            <span className="text-sm font-normal text-muted-ink"> / 100</span>
          </p>
          <div className="mt-2 flex justify-end">
            <RiskBandBadge band={riskBandFor(item.score.score)} />
          </div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
        <div>
          <dt className="text-muted-ink">{t("bidValue")}</dt>
          <dd className="num mt-1 text-right font-semibold">
            {formatCompactCurrency(item.bid.totalValueHKD)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-ink">{t("litigation")}</dt>
          <dd className="num mt-1 text-right font-semibold">
            {item.tenderer.activeLitigationCount}
          </dd>
        </div>
        <div>
          <dt className="text-muted-ink">{t("voRisk")}</dt>
          <dd className="mt-1 text-right font-semibold">{t("notAvailable")}</dd>
        </div>
      </dl>
      {item.tenderer.adversePressFlags > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-caution-bg px-3 py-2 text-sm text-caution">
          <TriangleAlert size={16} aria-hidden="true" />
          {t("adversePress", {
            count: item.tenderer.adversePressFlags,
            year: t("yearUnknown"),
          })}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => onShowScore(item.tenderer.id)}
        aria-controls="score-detail"
      >
        {t("explainScore")}
      </Button>
      <details className="mt-4 border-t border-line pt-3 text-sm">
        <summary className="w-fit cursor-pointer rounded-sm font-medium text-clay-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600">
          {t("auditTrail")}
        </summary>
        {item.auditEvents.length ? (
          <ol className="mt-3 max-h-40 space-y-2 overflow-y-auto text-muted-ink">
            {item.auditEvents.map((event) => (
              <li key={event.id} className="flex justify-between gap-3">
                <span>{t("documentReviewed")}</span>
                <time className="num shrink-0 text-right" dateTime={event.at}>
                  {formatDate(event.at, locale)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-muted-ink">{t("auditEmpty")}</p>
        )}
      </details>
    </article>
  );
}

export function TenderOverview({ projectId }: { projectId: string }) {
  const t = useTranslations("TenderOverview");
  const common = useTranslations("Common");
  const locale = useLocale() as FormatLocale;
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const latest = useLatestProjectJob(projectId);
  const completed =
    latest.job.data?.status === "succeeded" ||
    latest.job.data?.status === "partial";
  const overview = useTenderOverviewData(projectId, completed);
  const ranked = useMemo(
    () =>
      overview.data
        ? rankTenderers(
            overview.data.tenderers,
            overview.data.bids,
            overview.data.scores,
            overview.data.flags,
            overview.data.documents,
            overview.data.auditEvents,
          )
        : [],
    [overview.data],
  );
  const byId = useMemo(
    () => new Map(ranked.map((item) => [item.tenderer.id, item])),
    [ranked],
  );
  const pointLabels = useMemo(
    () =>
      Object.fromEntries(
        (overview.data?.distribution.points ?? []).map((point) => [
          point.tendererId,
          t("pointLabel", {
            name: byId.get(point.tendererId)?.tenderer.name ?? point.tendererId,
            sigma: formatSigma(point.sigma),
          }),
        ]),
      ),
    [overview.data, byId, t],
  );
  function openEvidence(tendererId: string) {
    const flag = byId.get(tendererId)?.evidenceFlag;
    if (!flag) return;
    const next = new URLSearchParams(params.toString());
    next.set("evidence", flag.id);
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  function updateScoreSelection(tendererId: string | null, compareId?: string | null) {
    const next = new URLSearchParams(params.toString());
    if (tendererId) next.set("tenderer", tendererId);
    else next.delete("tenderer");
    if (compareId) next.set("compare", compareId);
    else next.delete("compare");
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function openFlagEvidence(flagId: string) {
    const next = new URLSearchParams(params.toString());
    next.set("evidence", flagId);
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  if (
    latest.project.isPending ||
    (latest.project.data?.latestJobId && latest.job.isPending) ||
    (completed && overview.isPending)
  ) {
    return (
      <div className="space-y-5" aria-label={common("loading")}>
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (latest.project.isError || latest.job.isError || overview.isError)
    return (
      <ErrorState
        message={t("error")}
        action={{
          label: common("retry"),
          onClick: () => {
            void latest.project.refetch();
            void latest.job.refetch();
            void overview.refetch();
          },
        }}
      />
    );
  if (!completed) return <EmptyState message={t("noCompletedJob")} />;
  if (!overview.data || ranked.length === 0)
    return <EmptyState message={t("noBids")} />;
  const { kpis, distribution } = overview.data;
  const awardee = kpis.recommendedTendererId
    ? byId.get(kpis.recommendedTendererId)
    : undefined;
  const highRiskPercent = kpis.totalBidCount
    ? Math.min(100, (kpis.highRiskBidCount / kpis.totalBidCount) * 100)
    : 0;
  const elevated = Math.abs(kpis.avgRateVarianceZ) >= 1;
  const hasDistribution =
    distribution.benchmarkSigmaHKD > 0 && distribution.points.length > 0;
  const number = (value: number) => String(value).padStart(2, "0");
  const selectedId = params.get("tenderer");
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const compareId = params.get("compare");
  const comparison = compareId && compareId !== selectedId ? byId.get(compareId) : undefined;
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-ink">{t("description")}</p>
        </div>
        <p className="num text-right text-xs text-muted-ink">
          {t("benchmarkAsOf", {
            date: formatDate(kpis.benchmarkDataAsOf, locale),
          })}
        </p>
      </header>
      <section
        aria-label={t("keyMetrics")}
        className="grid gap-4 xl:grid-cols-3"
      >
        <article className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-[13px] font-medium text-muted-ink">
            {t("avgVariance")}
          </h2>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="num text-right text-[32px] font-bold leading-none">
              {formatSigma(kpis.avgRateVarianceZ)}
            </p>
            <VarianceSparkline
              values={distribution.points.map((p) => p.sigma)}
              label={t("varianceProfile")}
            />
          </div>
          <p className="mt-4 text-xs text-muted-ink">
            {t(elevated ? "elevated" : "normal")} · {t("varianceProfile")}
          </p>
        </article>
        <article className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-[13px] font-medium text-muted-ink">
            {t("highRiskBids")}
          </h2>
          <p className="num mt-3 text-right text-[32px] font-bold leading-none">
            {number(kpis.highRiskBidCount)}{" "}
            <span className="text-lg font-normal text-muted-ink">
              / {number(kpis.totalBidCount)}
            </span>
          </p>
          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-stone-50"
            role="progressbar"
            aria-label={t("highRiskBids")}
            aria-valuenow={kpis.highRiskBidCount}
            aria-valuemin={0}
            aria-valuemax={kpis.totalBidCount}
          >
            <div
              className="h-full bg-risk"
              style={{ width: `${highRiskPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-ink">{t("highRiskContext")}</p>
        </article>
        <article className="rounded-lg bg-ink p-5 text-limewash">
          <h2 className="text-[13px] font-medium text-sandstone">
            {t("recommendedAwardee")}
          </h2>
          {awardee ? (
            <>
              <p className="mt-3 text-lg font-semibold">
                {awardee.tenderer.name}
              </p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="num rounded-full bg-lichen px-3 py-1 text-right text-sm font-bold text-ink">
                  {t("scoreValue", { score: awardee.score.score.toFixed(1) })}
                </p>
                <p className="text-right text-xs text-sandstone">
                  {t("voExposure")}:{" "}
                  <span className="num">{t("notAvailable")}</span>
                </p>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-sandstone">
              {t("noRecommendation")}
            </p>
          )}
        </article>
      </section>
      {selected && (
        <ScoreDetailPanel
          primary={selected}
          comparison={comparison}
          tenderers={ranked}
          flags={overview.data.flags}
          onCompare={(id) => updateScoreSelection(selected.tenderer.id, id)}
          onClose={() => updateScoreSelection(null)}
          onEvidence={openFlagEvidence}
        />
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(440px,1.05fr)]">
        <section aria-labelledby="tenderers-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="tenderers-heading" className="text-lg font-semibold">
              {t("rankedTenderers")}
            </h2>
            <span className="num text-xs text-muted-ink">
              {t("tendererCount", { count: ranked.length })}
            </span>
          </div>
          {ranked.map((item) => (
            <TendererCard
              key={item.tenderer.id}
              item={item}
              locale={locale}
              onShowScore={(id) => updateScoreSelection(id)}
            />
          ))}
        </section>
        <div className="space-y-5">
          <section
            aria-labelledby="distribution-heading"
            className="rounded-lg border border-line bg-panel p-5"
          >
            <h2 id="distribution-heading" className="text-lg font-semibold">
              {t("distributionTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-ink">
              {t("distributionDescription", {
                threshold: distribution.thresholdSigma.toFixed(1),
              })}
            </p>
            {hasDistribution ? (
              <>
                <div className="mt-4 h-[340px]" aria-hidden="true">
                  <PriceDistributionPlot
                    distribution={distribution}
                    labels={pointLabels}
                    onPointClick={openEvidence}
                  />
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {distribution.points
                    .filter((point) => !point.withinTolerance)
                    .map((point) => (
                      <li key={point.tendererId}>
                        <button
                          type="button"
                          className="num inline-flex items-center gap-2 rounded-sm text-xs font-semibold text-risk underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-risk disabled:cursor-default disabled:text-muted-ink"
                          onClick={() => openEvidence(point.tendererId)}
                          disabled={!byId.get(point.tendererId)?.evidenceFlag}
                        >
                          <span
                            className="h-2 w-2 rounded-full bg-risk"
                            aria-hidden="true"
                          />
                          {pointLabels[point.tendererId]}
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <div className="mt-4 flex h-[340px] items-center justify-center">
                <InsufficientDataState />
              </div>
            )}
            {hasDistribution && (
              <table className="sr-only focus-within:not-sr-only focus-within:w-full focus-within:text-sm">
                <caption>{t("distributionTable")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("tenderer")}</th>
                    <th scope="col">{t("bidValue")}</th>
                    <th scope="col">{t("sigma")}</th>
                    <th scope="col">{t("tolerance")}</th>
                    <th scope="col">{t("evidence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.points.map((point) => (
                    <tr key={point.tendererId}>
                      <th scope="row">
                        {byId.get(point.tendererId)?.tenderer.name ??
                          point.tendererId}
                      </th>
                      <td className="num text-right">
                        {formatCompactCurrency(point.totalValueHKD)}
                      </td>
                      <td className="num text-right">
                        {formatSigma(point.sigma)}
                      </td>
                      <td>
                        {t(
                          point.withinTolerance
                            ? "withinTolerance"
                            : "outsideTolerance",
                        )}
                      </td>
                      <td>
                        {byId.get(point.tendererId)?.evidenceFlag ? (
                          <button
                            type="button"
                            onClick={() => openEvidence(point.tendererId)}
                          >
                            {t("openEvidence")}
                          </button>
                        ) : (
                          t("noEvidence")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section
            aria-labelledby="auditor-notes-heading"
            className="rounded-lg border border-line bg-panel p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="auditor-notes-heading" className="text-lg font-semibold">
                {t("auditorNotes")}
              </h2>
              <span className="rounded-full bg-stone-50 px-2 py-1 text-xs text-muted-ink">
                {t("generatedLabel")}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-ink">
              {t("notesBody", {
                count: distribution.points.filter(
                  (point) => !point.withinTolerance,
                ).length,
                threshold: distribution.thresholdSigma.toFixed(1),
              })}
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-clay-800">
              <ArrowUpRight size={14} aria-hidden="true" />
              {t("reviewEvidence")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
