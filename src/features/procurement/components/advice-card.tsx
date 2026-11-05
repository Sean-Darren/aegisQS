"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  AiGeneratedLabel,
  LowConfidenceNote,
  StatusChip,
  SummaryCard,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatPeriod,
  formatRange,
  formatSignedCurrency,
  type FormatLocale,
} from "@/lib/format";
import type { Material, PriceForecast, ProcurementAdvice } from "@/schemas";
import { adviceWindow } from "../model";
export function AdviceCard({
  advice,
  material,
  forecast,
}: {
  advice: ProcurementAdvice;
  material: Material;
  forecast?: PriceForecast;
}) {
  const t = useTranslations("Procurement");
  const locale = useLocale() as FormatLocale;
  const window = adviceWindow(advice, locale);
  return (
    <article
      className="space-y-4 rounded-lg border border-line bg-panel p-5 tabular-nums"
      aria-label={t("adviceFor", { material: material.name })}
    >
      <LowConfidenceNote kind="forecast" confidence={advice.confidence} />
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">
          <StatusChip
            domain="advice"
            value={advice.recommendation}
            className="h-auto rounded-md py-1 text-xl [&_svg]:size-5"
          />
          {window && <span className="ml-2 tabular-nums">· {window}</span>}
        </h2>
        <span className="rounded-sm border border-line px-2 py-1 text-xs">
          {t("confidence", {
            value: t(`confidenceValues.${advice.confidence}`),
          })}
        </span>
      </div>
      <p className="text-sm tabular-nums">
        {formatNumber(advice.quantity, locale)} {material.unit} ·{" "}
        {t("latestOrder", {
          date: formatDate(advice.latestOrderDate, locale),
          weeks: formatNumber(advice.leadTimeWeeks, locale),
        })}
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        <SummaryCard
          label={t("costNow")}
          value={formatCurrency(advice.costIfBoughtNow)}
          context={t("nowBasis", {
            period: formatPeriod(material.latestPeriod, locale),
          })}
        />
        <SummaryCard
          label={
            advice.expectedCostInWindow === undefined
              ? t("eligibleRange")
              : t("costWindow")
          }
          value={
            advice.expectedCostInWindow === undefined
              ? formatRange(advice.range.low, advice.range.high)
              : formatCurrency(advice.expectedCostInWindow)
          }
          context={t("likelyRange", {
            range: formatRange(advice.range.low, advice.range.high),
          })}
        />
        <SummaryCard
          label={t("saving")}
          value={
            advice.expectedSaving === undefined ? (
              t("noSaving")
            ) : (
              <span
                className={
                  advice.expectedSaving >= 0 ? "text-tolerance" : "text-risk"
                }
              >
                {formatSignedCurrency(advice.expectedSaving)}
              </span>
            )
          }
          context={
            advice.expectedSaving === undefined
              ? t("noSavingBasis")
              : t("savingRange", {
                  range: formatRange(
                    advice.costIfBoughtNow - advice.range.high,
                    advice.costIfBoughtNow - advice.range.low,
                    formatSignedCurrency,
                  ),
                })
          }
        />
      </div>
      <div>
        <h3 className="mb-2 font-semibold">{t("rationale")}</h3>
        <AiGeneratedLabel />
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {advice.rationale.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm tabular-nums">
        {t("neededBy")}: {formatDate(advice.neededBy, locale)}
      </p>
      {forecast && (
        <p className="text-xs text-muted-ink tabular-nums">
          {t("modelBasis", {
            model: `${forecast.model.name} ${forecast.model.version}`,
            period: formatPeriod(forecast.model.trainedThrough, locale),
            error: formatPercent(forecast.model.backtestMapePct / 100, locale),
          })}
        </p>
      )}
    </article>
  );
}
