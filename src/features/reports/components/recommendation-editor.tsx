"use client";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import type { Tenderer } from "@/schemas";

const fieldClass =
  "mt-1 h-9 w-full rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600";

export function RecommendationEditor({
  tenderers,
  recommendedTendererId,
  defaultTendererId,
  overrideReason,
  editable,
  onRecommendedTendererChange,
  onOverrideReasonChange,
}: {
  tenderers: Tenderer[];
  recommendedTendererId: string;
  defaultTendererId?: string;
  overrideReason: string;
  editable: boolean;
  onRecommendedTendererChange: (value: string) => void;
  onOverrideReasonChange: (value: string) => void;
}) {
  const t = useTranslations("Reports");
  const selected = tenderers.find((item) => item.id === recommendedTendererId);
  const override =
    !!recommendedTendererId && recommendedTendererId !== defaultTendererId;
  return (
    <section
      aria-labelledby="recommendation-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <h2 id="recommendation-title" className="text-lg font-semibold text-ink">
        {t("recommendation")}
      </h2>
      <p className="mt-1 text-sm text-muted-ink">{t("recommendationHelp")}</p>
      {editable ? (
        <label className="mt-4 block text-sm font-medium text-ink">
          {t("recommendedTenderer")}
          <select
            className={fieldClass}
            value={recommendedTendererId}
            onChange={(event) =>
              onRecommendedTendererChange(event.target.value)
            }
          >
            <option value="">{t("selectTenderer")}</option>
            {tenderers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-4 text-base font-semibold text-ink">
          {selected?.name ?? t("noRecommendation")}
        </p>
      )}
      {override && (
        <div className="mt-4">
          <label
            htmlFor="report-override-reason"
            className="block text-sm font-medium text-ink"
          >
            {t("overrideReason")}
          </label>
          {editable ? (
            <>
              <Textarea
                id="report-override-reason"
                className="mt-1"
                value={overrideReason}
                onChange={(event) => onOverrideReasonChange(event.target.value)}
                aria-invalid={
                  overrideReason.trim().length > 0 &&
                  overrideReason.trim().length < 10
                }
              />
              <p className="mt-1 text-xs text-muted-ink">
                {t("overrideReasonHelp")}
              </p>
            </>
          ) : (
            <p className="mt-1 max-w-prose text-sm text-ink">
              {overrideReason}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
