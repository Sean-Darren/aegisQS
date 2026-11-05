"use client";
import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations, useLocale } from "next-intl";
import {
  StatusChip,
  Skeleton,
  ErrorState,
  EmptyState,
  LowConfidenceNote,
  AiGeneratedLabel,
  SegmentedControl,
} from "@/components/ui";
import {
  formatPeriod,
  formatUnitRate,
  formatSignedPercent,
  formatPercent,
  formatRange,
  formatCurrency,
  type FormatLocale,
} from "@/lib/format";
import { useMaterials, useForecast } from "../hooks/queries";
import { lowForecastConfidence, forecastAt } from "../model";
import { ForecastTable } from "./forecast-table";
import { ForecastPlanning } from "@/features/procurement";
import type { ProcurementAdvice } from "@/schemas";
const FanChart = dynamic(() => import("./fan-chart").then((m) => m.FanChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});
export function MaterialForecastPage({ materialId }: { materialId: string }) {
  const t = useTranslations("Materials");
  const locale = useLocale() as FormatLocale;
  const materials = useMaterials();
  const forecast = useForecast(materialId);
  const [horizon, setHorizon] = useState(12);
  const [advice, setAdvice] = useState<ProcurementAdvice>();
  if (materials.isPending || forecast.isPending)
    return <Skeleton className="h-96 w-full" />;
  if (materials.isError || forecast.isError)
    return (
      <ErrorState
        message={t("error")}
        action={{
          label: t("retry"),
          onClick: () => {
            void materials.refetch();
            void forecast.refetch();
          },
        }}
      />
    );
  const material = materials.data.find((m) => m.id === materialId);
  if (!material) return <EmptyState message={t("notFound")} />;
  const data = forecast.data;
  const low = lowForecastConfidence(data.model.backtestMapePct);
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{material.name}</h1>
        <p className="text-3xl font-bold tabular-nums">
          {formatUnitRate(material.latestPrice, material.unit)}
        </p>
        <p className="tabular-nums">
          {formatPeriod(material.latestPeriod, locale)} · {t("change3m")}{" "}
          {formatSignedPercent(material.change3mPct / 100, locale)}
        </p>
        <StatusChip domain="priceTrend" value={material.trend} />
        <p className="text-xs text-muted-ink">
          {t("source")}: {material.source}
        </p>
      </header>
      <h2 className="text-lg font-semibold">{t("forecast")}</h2>
      <LowConfidenceNote kind="forecast" confidence={low ? "low" : "medium"} />
      {low && (
        <p className="text-sm tabular-nums">
          {t("lowError", {
            error: formatPercent(data.model.backtestMapePct / 100, locale),
          })}
        </p>
      )}
      {data.forecast.length === 0 && <EmptyState message={t("noForecast")} />}
      {data.history.length === 0 && <EmptyState message={t("noHistory")} />}
      {
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <ForecastPlanning
            material={material}
            forecast={data}
            onAdvice={setAdvice}
          />
        </Suspense>
      }
      {data.history.length > 0 && data.forecast.length > 0 && (
        <section className="space-y-3 rounded-lg border border-line bg-panel p-4">
          <SegmentedControl
            label={t("horizon")}
            value={String(horizon)}
            onValueChange={(v) => setHorizon(Number(v))}
            options={[3, 6, 12].map((value) => ({
              value: String(value),
              label: t("months", { count: value }),
            }))}
          />
          <FanChart
            material={material}
            forecast={data}
            horizon={horizon}
            advice={advice}
          />
        </section>
      )}
      {
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("glance")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[3, 6].map((months) => {
              const p = forecastAt(data, material.latestPeriod, months);
              return (
                <article
                  key={months}
                  className="space-y-2 rounded-lg border border-line bg-panel p-4"
                >
                  <h3 className="font-semibold">{t("ahead", { months })}</h3>
                  {p ? (
                    <>
                      <p className="tabular-nums">
                        {t("likely", {
                          range: formatRange(p.p10, p.p90, formatCurrency),
                          unit: material.unit,
                          period: formatPeriod(p.period, locale),
                        })}
                      </p>
                      <p className="text-sm tabular-nums">
                        {t("median")}: {formatUnitRate(p.p50, material.unit)}
                      </p>
                    </>
                  ) : (
                    <p>{t("unavailable")}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      }
      <details className="rounded-lg border border-line bg-panel p-4">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-clay-600">
          {t("dataTable")}
        </summary>
        <ForecastTable material={material} forecast={data} horizon={horizon} />
      </details>
      <section className="space-y-3 rounded-lg border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">{t("model")}</h2>
        <p>
          {data.model.name} · {data.model.version}
        </p>
        <p className="tabular-nums">
          {t("trainedThrough", {
            period: formatPeriod(data.model.trainedThrough, locale),
          })}
        </p>
        <p className="tabular-nums">
          {t("backtest", {
            error: formatPercent(data.model.backtestMapePct / 100, locale),
          })}
        </p>
        <p className="text-xs text-muted-ink">{t("backtestBasis")}</p>
        <h3>{t("drivers")}</h3>
        <AiGeneratedLabel />
        <ul className="list-disc pl-5">
          {data.model.drivers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
