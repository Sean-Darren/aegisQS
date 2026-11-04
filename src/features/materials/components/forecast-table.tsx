"use client";
import { useTranslations, useLocale } from "next-intl";
import type { Material, PriceForecast } from "@/schemas";
import {
  formatPeriod,
  formatUnitRate,
  formatRange,
  formatCurrency,
  type FormatLocale,
} from "@/lib/format";
export function ForecastTable({
  material,
  forecast,
  horizon = 12,
}: {
  material: Material;
  forecast: PriceForecast;
  horizon?: number;
}) {
  const t = useTranslations("Materials");
  const locale = useLocale() as FormatLocale;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm tabular-nums">
        <caption className="text-left text-muted-ink">
          {t("dataBasis", { unit: material.unit })}
        </caption>
        <thead>
          <tr>
            {["period", "history", "median", "band80", "band95"].map((k) => (
              <th
                key={k}
                scope="col"
                className={`p-2 ${k === "period" ? "text-left" : "text-right"}`}
              >
                {t(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {forecast.history.map((p) => (
            <tr key={p.period} className="border-t border-line">
              <th scope="row" className="p-2 text-left font-normal">
                {formatPeriod(p.period, locale)}
              </th>
              <td className="p-2 text-right">
                {formatUnitRate(p.price, material.unit)}
              </td>
              <td className="p-2 text-right">—</td>
              <td className="p-2 text-right">—</td>
              <td className="p-2 text-right">—</td>
            </tr>
          ))}
          {forecast.forecast.slice(0, horizon).map((p) => (
            <tr key={p.period} className="border-t border-line">
              <th scope="row" className="p-2 text-left font-normal">
                {formatPeriod(p.period, locale)}
              </th>
              <td className="p-2 text-right">—</td>
              <td className="p-2 text-right">
                {formatUnitRate(p.p50, material.unit)}
              </td>
              <td className="p-2 text-right">
                {formatRange(p.p10, p.p90, formatCurrency)}
              </td>
              <td className="p-2 text-right">
                {formatRange(p.p025, p.p975, formatCurrency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
