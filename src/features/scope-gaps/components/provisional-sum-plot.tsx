"use client";
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useTranslations } from "next-intl";
import { registerAegisTheme } from "@/components/charts/theme";
import { thresholds } from "@/lib/config";
import { formatCompactCurrency, formatPercent } from "@/lib/format";
import type { Bid, Tenderer } from "@/schemas";
import { exceedsProvisionalSumThreshold, provisionalSumShare } from "../model";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

export default function ProvisionalSumPlot({
  bids,
  tenderers,
  flagIdsByTenderer,
  onFlagClick,
}: {
  bids: Bid[];
  tenderers: Tenderer[];
  flagIdsByTenderer: Record<string, string>;
  onFlagClick: (flagId: string) => void;
}) {
  const t = useTranslations("ScopeGaps");
  const option = useMemo<EChartsOption>(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const names = new Map(tenderers.map((item) => [item.id, item.name]));
    const shares = bids.map((bid) => provisionalSumShare(bid));
    return {
      animation: false,
      grid: { top: 52, right: 24, bottom: 98, left: 48, containLabel: true },
      legend: { top: 0, textStyle: { color: token("--ink") } },
      tooltip: {
        trigger: "axis",
        formatter: (value) => {
          const first = Array.isArray(value) ? value[0] : value;
          const index = first?.dataIndex ?? 0;
          const bid = bids[index];
          return bid
            ? shares[index] === null
              ? `${escapeHtml(names.get(bid.tendererId) ?? bid.tendererId)}<br/>${t("insufficientBidData")}`
              : `${escapeHtml(names.get(bid.tendererId) ?? bid.tendererId)}<br/>${t("measuredWork")}: ${formatCompactCurrency(bid.totalValueHKD - bid.provisionalSumHKD)}<br/>${t("provisionalSums")}: ${formatCompactCurrency(bid.provisionalSumHKD)} (${formatPercent(shares[index]!)})`
            : "";
        },
      },
      xAxis: {
        type: "category",
        data: bids.map((bid) => names.get(bid.tendererId) ?? bid.tendererId),
        axisLabel: { rotate: 48, fontSize: 10, color: token("--muted-ink") },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { formatter: "{value}%", color: token("--muted-ink") },
        splitLine: { lineStyle: { color: token("--chart-grid") } },
      },
      series: [
        {
          name: t("provisionalSums"),
          type: "bar",
          stack: "bid",
          barMaxWidth: 38,
          itemStyle: { color: token("--clay-600") },
          data: bids.map((bid, i) => ({
            value: shares[i] === null ? null : shares[i]! * 100,
            cursor: flagIdsByTenderer[bid.tendererId] ? "pointer" : "default",
            itemStyle: {
              color: token(
                exceedsProvisionalSumThreshold(bid) ? "--risk" : "--clay-600",
              ),
            },
            label: {
              show: shares[i] !== null && exceedsProvisionalSumThreshold(bid),
              position: "top",
              formatter: shares[i] === null ? "" : formatPercent(shares[i]!),
              color: token("--risk"),
              fontWeight: 700,
            },
          })),
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: { color: token("--risk"), type: "dashed", width: 1 },
            label: {
              show: true,
              formatter: t("threshold", {
                percent: thresholds.provisionalSumPercent,
              }),
              color: token("--risk"),
              position: "insideEndTop",
            },
            data: [{ yAxis: thresholds.provisionalSumPercent }],
          },
        },
        {
          name: t("measuredWork"),
          type: "bar",
          stack: "bid",
          barMaxWidth: 38,
          itemStyle: { color: token("--chart-5") },
          data: bids.map((bid, i) => ({
            value: shares[i] === null ? null : 100 - shares[i]! * 100,
            cursor: flagIdsByTenderer[bid.tendererId] ? "pointer" : "default",
          })),
        },
      ],
    };
  }, [bids, tenderers, flagIdsByTenderer, t]);
  return (
    <ReactECharts
      theme={registerAegisTheme()}
      option={option}
      style={{ height: 430, width: "100%" }}
      onEvents={{
        click: (event: { seriesType?: string; dataIndex?: number }) => {
          if (event.seriesType !== "bar" || event.dataIndex === undefined)
            return;
          const bid = bids[event.dataIndex];
          const flagId = bid && flagIdsByTenderer[bid.tendererId];
          if (flagId) onFlagClick(flagId);
        },
      }}
    />
  );
}
