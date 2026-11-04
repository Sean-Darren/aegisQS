"use client";
import { useTranslations } from "next-intl";
import { useForecast } from "../hooks/queries";
import { Skeleton } from "@/components/ui";
export function MaterialSparkline({ materialId }: { materialId: string }) {
  const t = useTranslations("Materials");
  const query = useForecast(materialId);
  if (query.isPending) return <Skeleton className="h-8 w-28" />;
  if (query.isError)
    return <span className="text-xs">{t("historyError")}</span>;
  const prices = query.data.history.slice(-12).map((p) => p.price);
  if (!prices.length) return <span>{t("noHistory")}</span>;
  const low = Math.min(...prices),
    high = Math.max(...prices);
  const points = prices
    .map(
      (p, i) =>
        `${4 + (i * 104) / Math.max(1, prices.length - 1)},${28 - ((p - low) * 24) / (high - low || 1)}`,
    )
    .join(" ");
  return (
    <svg role="img" aria-label={t("sparkline")} width={112} height={32}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--clay-600)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
