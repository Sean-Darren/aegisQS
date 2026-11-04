"use client";
import { useTranslations, useLocale } from "next-intl";
import { AegisEChart } from "@/components/charts/echarts-core";
import { registerAegisTheme } from "@/components/charts/theme";
import { formatPeriod, formatDate, type FormatLocale } from "@/lib/format";
import { buildFanChartOptions } from "../chart-options";
import type { Material, PriceForecast, ProcurementAdvice } from "@/schemas";
export function FanChart({
  material,
  forecast,
  horizon,
  advice,
}: {
  material: Material;
  forecast: PriceForecast;
  horizon: number;
  advice?: ProcurementAdvice;
}) {
  const t = useTranslations("Materials");
  const locale = useLocale() as FormatLocale;
  const p = useTranslations("Procurement");
  const css = getComputedStyle(document.documentElement);
  const color = (key: string) => css.getPropertyValue(key).trim();
  const options = buildFanChartOptions(
    material,
    forecast,
    horizon,
    {
      buyWindow: p("buyWindow"),
      latestOrder: advice
        ? p("orderLine", { date: formatDate(advice.latestOrderDate, locale) })
        : undefined,
      neededBy: advice
        ? p("needLine", { date: formatDate(advice.neededBy, locale) })
        : undefined,
      history: t("history"),
      median: t("median"),
      band80: t("band80"),
      band95: t("band95"),
      latest: t("latestData", {
        period: formatPeriod(
          forecast.history.at(-1)?.period ?? material.latestPeriod,
          locale,
        ),
      }),
      unitAxis: t("unitAxis", { unit: material.unit }),
    },
    {
      ink: color("--ink"),
      median: color("--clay-700"),
      band80: color("--limewash"),
      band95: color("--limewash-100"),
      muted: color("--muted-ink"),
      window: color("--lichen"),
      caution: color("--caution"),
    },
    locale,
    advice,
  );
  const lastPeriod = options.xAxis.data.at(-1) ?? "";
  const outside =
    advice &&
    [
      advice.neededBy.slice(0, 7),
      advice.latestOrderDate.slice(0, 7),
      advice.window?.to ?? "",
    ].some((period) => period > lastPeriod);
  return (
    <div>
      {outside && (
        <p className="text-sm text-muted-ink">{p("overlayOutside")}</p>
      )}
      <div
        role="img"
        aria-label={t("chartAlt", { name: material.name })}
        className="h-[420px]"
      >
        <AegisEChart
          theme={registerAegisTheme()}
          option={options}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
