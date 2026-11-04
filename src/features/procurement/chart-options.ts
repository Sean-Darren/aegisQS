import {
  formatCompactCurrency,
  formatCurrency,
  formatRange,
} from "@/lib/format";
import type { exposureRows } from "./model";
export function buildExposureOptions(
  rows: ReturnType<typeof exposureRows>,
  labels: { rising: string; median: string; range: string },
  colors: { bar: string; ink: string },
) {
  return {
    animation: false,
    grid: { left: 230, right: 35, top: 20, bottom: 40 },
    xAxis: { type: "value", axisLabel: { formatter: formatCompactCurrency } },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map(
        (r) =>
          `${r.material.name}${r.material.trend === "rising" ? ` · ${labels.rising}` : ""}`,
      ),
      axisLabel: { width: 215, overflow: "truncate" },
    },
    tooltip: {
      trigger: "item",
      renderMode: "richText",
      formatter: (p: { dataIndex: number }) => {
        const r = rows[p.dataIndex];
        return r
          ? `${r.material.name}\n${labels.median}: ${formatCurrency(r.p50)}\n${labels.range}: ${formatRange(r.p10, r.p90)}`
          : "";
      },
    },
    series: [
      {
        type: "bar",
        name: labels.median,
        data: rows.map((r) => r.p50),
        barMaxWidth: 24,
        itemStyle: { color: colors.bar },
        markLine: {
          silent: true,
          animation: false,
          symbol: ["rect", "rect"],
          symbolSize: [12, 2],
          lineStyle: { color: colors.ink, width: 1.5, type: "solid" },
          label: { show: false },
          data: rows.map((r, i) => [
            { coord: [r.p10, i] },
            { coord: [r.p90, i] },
          ]),
        },
      },
    ],
  };
}
