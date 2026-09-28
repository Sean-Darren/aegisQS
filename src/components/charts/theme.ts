"use client";
import * as echarts from "echarts/core";
const themeName = "aegisqs";
let registered = false;
/** Register the single token-derived ECharts theme in the browser. */
export function registerAegisTheme() {
  if (registered || typeof document === "undefined") return themeName;
  const css = getComputedStyle(document.documentElement);
  const color = (token: string) => css.getPropertyValue(token).trim();
  echarts.registerTheme(themeName, {
    color: [
      color("--chart-5"),
      color("--chart-1"),
      color("--chart-2"),
      color("--chart-3"),
      color("--chart-4"),
    ],
    backgroundColor: color("--panel"),
    textStyle: {
      fontFamily: getComputedStyle(document.body).fontFamily,
      color: color("--ink"),
      fontSize: 12,
      fontFeatureSettings: '"tnum" 1',
    },
    title: {
      textStyle: {
        fontFamily: getComputedStyle(document.body).fontFamily,
        color: color("--ink"),
      },
    },
    legend: { textStyle: { color: color("--muted-ink") } },
    categoryAxis: {
      axisLine: { lineStyle: { color: color("--line") } },
      axisLabel: {
        color: color("--muted-ink"),
        fontSize: 12,
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontFeatureSettings: '"tnum" 1',
      },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: color("--line") } },
      axisLabel: {
        color: color("--muted-ink"),
        fontSize: 12,
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontFeatureSettings: '"tnum" 1',
      },
      splitLine: { lineStyle: { color: color("--chart-grid"), type: "solid" } },
    },
    tooltip: {
      backgroundColor: color("--panel"),
      borderColor: color("--line"),
      textStyle: {
        color: color("--ink"),
        fontFamily: getComputedStyle(document.body).fontFamily,
      },
    },
    animation: false,
  });
  registered = true;
  return themeName;
}
