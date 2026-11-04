// Original Smart QS provenance label; no external component code.
"use client";
import { useTranslations } from "next-intl";
export function AiGeneratedLabel() {
  const t = useTranslations("Primitives");
  return <span className="text-xs text-muted-ink">{t("aiGenerated")}</span>;
}
