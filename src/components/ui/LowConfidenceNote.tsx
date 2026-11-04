// Original Smart QS semantic label; no external component code.
"use client";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { confidenceThresholds } from "@/lib/config";
type Props =
  | { kind?: "change" | "alignment"; confidence: number }
  | { kind: "forecast"; confidence: "low" | "medium" | "high" };
export function LowConfidenceNote({ kind = "change", confidence }: Props) {
  const t = useTranslations("Primitives");
  const low =
    typeof confidence === "number"
      ? confidence < confidenceThresholds[kind as "change" | "alignment"]
      : confidence === "low";
  if (!low) return null;
  return (
    <p className="inline-flex items-start gap-1 rounded-sm bg-stone-50 px-2 py-1 text-xs text-muted-ink">
      <Info size={14} strokeWidth={1.5} aria-hidden="true" />
      {t(kind === "forecast" ? "lowForecastConfidence" : "lowConfidence")}
    </p>
  );
}
