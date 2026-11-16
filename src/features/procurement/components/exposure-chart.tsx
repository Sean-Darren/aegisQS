"use client";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AegisEChart } from "@/components/charts/echarts-core";
import { registerAegisTheme } from "@/components/charts/theme";
import type { exposureRows } from "../model";
import { buildExposureOptions } from "../chart-options";
export function ExposureChart({
  rows,
}: {
  rows: ReturnType<typeof exposureRows>;
}) {
  const t = useTranslations("Procurement");
  const option = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    return buildExposureOptions(
      rows,
      {
        rising: t("rising"),
        median: t("exposureMedian"),
        range: t("exposureRange"),
      },
      {
        bar: css.getPropertyValue("--chart-5").trim(),
        ink: css.getPropertyValue("--ink").trim(),
      },
    );
  }, [rows, t]);
  return (
    <div className="h-[360px]" role="img" aria-label={t("exposureAlt")}>
      <AegisEChart
        option={option}
        theme={registerAegisTheme()}
        style={{ height: "100%" }}
      />
    </div>
  );
}
