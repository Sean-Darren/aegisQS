"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Button,
  StatusChip,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import {
  formatUnitRate,
  formatSignedPercent,
  formatPeriod,
  type FormatLocale,
} from "@/lib/format";
import { materialSchema } from "@/schemas";
import { useMaterials } from "../hooks/queries";
import { MaterialSparkline } from "./sparkline";
export function MaterialsPage() {
  const t = useTranslations("Materials");
  const locale = useLocale() as FormatLocale;
  const query = useMaterials();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const data = query.data ?? [];
  const rows = data.filter(
    (m) =>
      (!category || m.category === category) &&
      `${m.name} ${m.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={category === "" ? "primary" : "outline"}
          aria-pressed={category === ""}
          onClick={() => setCategory("")}
        >
          {t("all")} <span className="tabular-nums">{data.length}</span>
        </Button>
        {materialSchema.shape.category.options.map((c) => (
          <Button
            variant={category === c ? "primary" : "outline"}
            aria-pressed={category === c}
            key={c}
            onClick={() => setCategory(c)}
          >
            {t(`categories.${c}`)}{" "}
            <span className="tabular-nums">
              {data.filter((m) => m.category === c).length}
            </span>
          </Button>
        ))}
      </div>
      <label className="block max-w-md">
        {t("search")}
        <input
          className={inputStyle}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {query.isPending && <Skeleton className="h-96 w-full" />}
      {query.isError && (
        <ErrorState
          message={t("error")}
          action={{ label: t("retry"), onClick: () => void query.refetch() }}
        />
      )}
      {query.data && rows.length === 0 && (
        <EmptyState message={data.length ? t("noMatches") : t("empty")} />
      )}
      {rows.length > 0 && (
        <div className="overflow-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-stone-50">
              <tr>
                {[
                  "material",
                  "unit",
                  "latestPrice",
                  "change3m",
                  "trend",
                  "history12",
                  "actions",
                ].map((k) => (
                  <th
                    scope="col"
                    key={k}
                    className={`p-3 ${["latestPrice", "change3m"].includes(k) ? "text-right" : "text-left"}`}
                  >
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <th scope="row" className="p-3 text-left font-medium">
                    {m.name}
                    <p className="text-xs text-muted-ink">{m.code}</p>
                  </th>
                  <td className="p-3">{m.unit}</td>
                  <td className="p-3 text-right">
                    {formatUnitRate(m.latestPrice, m.unit)}
                    <p className="text-xs text-muted-ink">
                      {formatPeriod(m.latestPeriod, locale)}
                    </p>
                  </td>
                  <td
                    className={`p-3 text-right ${m.change3mPct > 0 ? "text-risk" : "text-ink"}`}
                  >
                    {formatSignedPercent(m.change3mPct / 100, locale)}
                  </td>
                  <td className="p-3">
                    <StatusChip domain="priceTrend" value={m.trend} />
                  </td>
                  <td className="p-3">
                    <MaterialSparkline materialId={m.id} />
                  </td>
                  <td className="p-3">
                    <Link
                      className="text-clay-700 underline"
                      href={`/materials/${encodeURIComponent(m.id)}`}
                    >
                      {t("viewForecast")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
