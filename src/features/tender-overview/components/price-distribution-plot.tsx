"use client";
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { registerAegisTheme } from "@/components/charts/theme";
import type { PriceDistribution } from "@/schemas";
import { formatCompactCurrency } from "@/lib/format";
import { benchmarkCurve } from "../model";

export default function PriceDistributionPlot({
  distribution,
  labels,
  onPointClick,
}: {
  distribution: PriceDistribution;
  labels: Record<string, string>;
  onPointClick: (tendererId: string) => void;
}) {
  const option = useMemo<EChartsOption>(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const mean = distribution.benchmarkMeanHKD;
    const sigma = distribution.benchmarkSigmaHKD;
    const threshold = distribution.thresholdSigma;
    const points = distribution.points.map((point) => ({
      name: point.tendererId,
      value: [point.totalValueHKD, Math.exp(-(point.sigma ** 2) / 2)],
      sigma: point.sigma,
      symbolSize: point.withinTolerance ? 10 : 14,
      itemStyle: {
        color: token(point.withinTolerance ? "--chart-2" : "--risk"),
      },
    }));
    return {
      animation: false,
      grid: { top: 24, right: 104, bottom: 42, left: 48, containLabel: true },
      xAxis: {
        type: "value",
        min: mean - 3.4 * sigma,
        max: mean + 3.4 * sigma,
        axisLabel: {
          formatter: (value: number) => formatCompactCurrency(value),
        },
      },
      yAxis: { type: "value", min: 0, max: 1.12, axisLabel: { show: false } },
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          return item?.name ? (labels[item.name] ?? "") : "";
        },
      },
      series: [
        {
          type: "line",
          name: "benchmark",
          data: benchmarkCurve(distribution),
          symbol: "none",
          lineStyle: { color: token("--clay-600"), width: 2 },
          markArea: {
            silent: true,
            data: [
              [
                {
                  xAxis: mean - threshold * sigma,
                  itemStyle: { color: token("--caution-bg") },
                },
                { xAxis: mean + threshold * sigma },
              ],
              [
                {
                  xAxis: mean - sigma,
                  itemStyle: { color: token("--limewash") },
                },
                { xAxis: mean + sigma },
              ],
            ],
          },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: { color: token("--caution"), type: "dashed", width: 1 },
            label: {
              show: true,
              formatter: `±${threshold.toFixed(1)}σ`,
              color: token("--caution"),
            },
            data: [
              { xAxis: mean - threshold * sigma },
              { xAxis: mean + threshold * sigma },
            ],
          },
        },
        { type: "scatter", name: "bids", data: points },
      ],
    };
  }, [distribution, labels]);
  return (
    <ReactECharts
      theme={registerAegisTheme()}
      option={option}
      style={{ height: 340, width: "100%" }}
      onEvents={{
        click: (event: { seriesName?: string; data?: { name?: string } }) => {
          if (event.seriesName === "bids" && event.data?.name)
            onPointClick(event.data.name);
        },
      }}
    />
  );
}
