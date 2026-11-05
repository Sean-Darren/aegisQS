"use client";
import { useTranslations } from "next-intl";
import { AegisEChart } from "@/components/charts/echarts-core";
import { registerAegisTheme } from "@/components/charts/theme";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { WorkbookVersion } from "@/schemas";
export function VersionTotalsChart({
  versions,
  onSelect,
}: {
  versions: WorkbookVersion[];
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("WorkbookDiff");
  const ordered = [...versions].sort(
    (a, b) => a.versionNumber - b.versionNumber,
  );
  return (
    <div className="h-48" role="img" aria-label={t("chartAlternative")}>
      <AegisEChart
        theme={registerAegisTheme()}
        style={{ height: "100%" }}
        option={{
          animation: false,
          grid: { left: 90, right: 24, top: 12, bottom: 32 },
          tooltip: {
            trigger: "axis",
            valueFormatter: (v: unknown) =>
              typeof v === "number" && Number.isFinite(v)
                ? formatCurrency(v)
                : t("unavailable"),
          },
          xAxis: {
            type: "category",
            data: ordered.map((v) => t("version", { number: v.versionNumber })),
          },
          yAxis: {
            type: "value",
            name: "HK$",
            axisLabel: { formatter: (v: number) => formatCompactCurrency(v) },
          },
          series: [
            {
              type: "line",
              step: "end",
              symbolSize: 9,
              connectNulls: false,
              lineStyle: {
                width: 1.5,
                color: getComputedStyle(
                  document.documentElement,
                ).getPropertyValue("--ink"),
              },
              itemStyle: {
                color: getComputedStyle(
                  document.documentElement,
                ).getPropertyValue("--ink"),
              },
              data: ordered.map(
                (v) =>
                  v.totals?.reduce((sum, total) => sum + total.amount, 0) ??
                  null,
              ),
            },
          ],
        }}
        onEvents={{
          click: (point: { dataIndex: number }) => {
            const v = ordered[point.dataIndex];
            if (v) onSelect(v.id);
          },
        }}
      />
    </div>
  );
}
