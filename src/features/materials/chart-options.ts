import type { Material, PriceForecast, ProcurementAdvice } from "@/schemas";
import {
  formatPeriod,
  formatUnitRate,
  formatRange,
  formatCurrency,
  type FormatLocale,
} from "@/lib/format";
export type FanLabels = {
  history: string;
  median: string;
  band80: string;
  band95: string;
  latest: string;
  unitAxis: string;
  buyWindow?: string;
  latestOrder?: string;
  neededBy?: string;
};
export type FanColors = {
  ink: string;
  median: string;
  band80: string;
  band95: string;
  muted: string;
  window?: string;
  caution?: string;
};
export function buildFanChartOptions(
  material: Material,
  forecast: PriceForecast,
  horizon: number,
  labels: FanLabels,
  colors: FanColors,
  locale: FormatLocale = "en",
  advice?: ProcurementAdvice,
) {
  const history = [...forecast.history].sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  const last = history.at(-1);
  const future = [...forecast.forecast]
    .sort((a, b) => a.period.localeCompare(b.period))
    .filter((p) => p.period > (last?.period ?? material.latestPeriod))
    .slice(0, horizon);
  const periods = [
    ...history.map((p) => p.period),
    ...future.map((p) => p.period),
  ];
  const prefix = history.map((_, i) =>
    i === history.length - 1 ? last!.price : null,
  );
  const baseline = (field: "p10" | "p025") => [
    ...prefix,
    ...future.map((p) => p[field]),
  ];
  const span = (low: "p10" | "p025", high: "p90" | "p975") => [
    ...history.map((_, i) => (i === history.length - 1 ? 0 : null)),
    ...future.map((p) => p[high] - p[low]),
  ];
  const bands = (
    stack: string,
    name: string,
    low: "p10" | "p025",
    high: "p90" | "p975",
    color: string,
  ) => [
    {
      id: `${stack}-lower`,
      type: "line" as const,
      stack,
      stackStrategy: "all" as const,
      data: baseline(low),
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      silent: true,
      tooltip: { show: false },
    },
    {
      id: stack,
      name,
      type: "line" as const,
      stack,
      stackStrategy: "all" as const,
      data: span(low, high),
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: { color, opacity: 1 },
      itemStyle: { color },
      silent: true,
      tooltip: { show: false },
    },
  ];
  const datePosition = (iso: string) => {
    const day = new Date(iso);
    const index = periods.indexOf(day.toISOString().slice(0, 7));
    return index < 0
      ? undefined
      : index -
          0.5 +
          (day.getUTCDate() - 1) /
            new Date(
              Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
            ).getUTCDate();
  };
  const order = advice ? datePosition(advice.latestOrderDate) : undefined;
  const needed = advice ? datePosition(advice.neededBy) : undefined;
  const start = advice?.window ? periods.indexOf(advice.window.from) : -1;
  const end = advice?.window ? periods.indexOf(advice.window.to) : -1;
  return {
    animation: false,
    grid: { left: 100, right: 24, top: 48, bottom: 45 },
    legend: {
      data: [labels.history, labels.median, labels.band80, labels.band95],
      top: 0,
    },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      formatter: (params: { dataIndex: number }[]) => {
        const period = periods[params[0]?.dataIndex];
        if (!period) return "";
        const point = future.find((p) => p.period === period);
        if (point)
          return `${formatPeriod(period, locale)}\n${labels.median}: ${formatUnitRate(point.p50, material.unit)}\n${labels.band80}: ${formatRange(point.p10, point.p90, formatCurrency)} / ${material.unit}\n${labels.band95}: ${formatRange(point.p025, point.p975, formatCurrency)} / ${material.unit}`;
        const actual = history.find((p) => p.period === period);
        return actual
          ? `${formatPeriod(period, locale)}\n${labels.history}: ${formatUnitRate(actual.price, material.unit)}`
          : "";
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: periods,
      axisLabel: {
        formatter: (p: string) => formatPeriod(p, locale),
        hideOverlap: true,
      },
    },
    yAxis: {
      type: "value",
      name: labels.unitAxis,
      nameLocation: "end",
      axisLabel: { formatter: (v: number) => formatCurrency(v) },
    },
    series: [
      {
        id: "procurement-overlay",
        type: "line",
        data: periods.map(() => null),
        symbol: "none",
        silent: true,
        markArea:
          start >= 0 && end >= 0
            ? {
                silent: true,
                itemStyle: {
                  color: colors.window ?? colors.muted,
                  opacity: 0.35,
                },
                label: { color: colors.ink, position: "insideTop" },
                data: [
                  [
                    { name: labels.buyWindow, xAxis: start - 0.5 },
                    { xAxis: end + 0.5 },
                  ],
                ],
              }
            : undefined,
        markLine: {
          silent: true,
          symbol: "none",
          label: { position: "insideEndTop", formatter: "{b}" },
          data: [
            ...(order === undefined
              ? []
              : [
                  {
                    name: labels.latestOrder,
                    xAxis: order,
                    lineStyle: {
                      color: colors.caution ?? colors.muted,
                      type: "dashed",
                      width: 1,
                    },
                  },
                ]),
            ...(needed === undefined
              ? []
              : [
                  {
                    name: labels.neededBy,
                    xAxis: needed,
                    lineStyle: { color: colors.ink, type: "solid", width: 1 },
                  },
                ]),
          ],
        },
      },
      ...bands("range95", labels.band95, "p025", "p975", colors.band95),
      ...bands("range80", labels.band80, "p10", "p90", colors.band80),
      {
        id: "history",
        name: labels.history,
        type: "line",
        data: [...history.map((p) => p.price), ...future.map(() => null)],
        symbol: "none",
        lineStyle: { color: colors.ink, width: 1.75 },
        itemStyle: { color: colors.ink },
        markLine: last
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { color: colors.muted, width: 1, type: "solid" },
              label: { formatter: labels.latest, position: "insideEndTop" },
              data: [{ xAxis: last.period }],
            }
          : undefined,
      },
      {
        id: "median",
        name: labels.median,
        type: "line",
        data: [...prefix, ...future.map((p) => p.p50)],
        symbol: "none",
        lineStyle: { color: colors.median, width: 1.75, type: "dashed" },
        itemStyle: { color: colors.median },
      },
    ],
  };
}
