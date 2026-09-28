"use client";
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { registerAegisTheme } from "@/components/charts/theme";
import type { SignalKey } from "@/schemas";
import type { RankedTenderer } from "../model";

export default function ScoreSignalPlot({
  items,
  signalKeys,
  labels,
}: {
  items: RankedTenderer[];
  signalKeys: SignalKey[];
  labels: Record<SignalKey, string>;
}) {
  const option = useMemo<EChartsOption>(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const maximum = Math.max(
      1,
      ...items.flatMap((item) =>
        item.score.signals
          .filter((signal) => signal.dataSufficient)
          .map((signal) => signal.contribution),
      ),
    );
    return {
      animation: false,
      grid: { top: 16, right: 72, bottom: 34, left: 200 },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(maximum * 1.25),
        splitLine: { show: true },
        axisLabel: { formatter: (value: number) => value.toFixed(0) },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: signalKeys.map((key) => labels[key]),
        axisTick: { show: false },
        axisLabel: { width: 185, overflow: "truncate" },
      },
      tooltip: { show: false },
      series: items.map((item, index) => ({
        name: item.tenderer.name,
        type: "bar" as const,
        barMaxWidth: items.length === 1 ? 24 : 16,
        itemStyle: {
          color: token(index === 0 ? "--clay-600" : "--ink"),
        },
        label: {
          show: true,
          position: "right" as const,
          color: token("--ink"),
          formatter: (params: { value?: number }) =>
            typeof params.value === "number" ? params.value.toFixed(1) : "",
        },
        data: signalKeys.map((key) => {
          const signal = item.score.signals.find((entry) => entry.signal === key);
          return signal?.dataSufficient ? signal.contribution : null;
        }),
      })),
    };
  }, [items, signalKeys, labels]);
  return (
    <ReactECharts
      theme={registerAegisTheme()}
      option={option}
      style={{ height: 390, width: "100%" }}
    />
  );
}
