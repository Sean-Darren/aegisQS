"use client";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, type FormatLocale } from "@/lib/format";
import type { Report } from "@/schemas";

export function ReportProvenance({
  report,
  signatoryName,
  disclaimer,
}: {
  report: Report;
  signatoryName?: string;
  disclaimer: string;
}) {
  const t = useTranslations("Reports");
  const locale = useLocale() as FormatLocale;
  const rows = [
    [
      t("signatory"),
      report.signedBy ? (signatoryName ?? report.signedBy) : t("notSigned"),
    ],
    [
      t("signedDate"),
      report.signedAt ? formatDate(report.signedAt, locale) : t("notSigned"),
    ],
    [t("modelVersion"), report.modelVersion],
    [t("toolSchemaVersion"), report.toolSchemaVersion],
    [t("benchmarkDataAsOf"), formatDate(report.benchmarkDataAsOf, locale)],
  ];
  return (
    <section
      aria-labelledby="report-provenance-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <h2
        id="report-provenance-title"
        className="text-lg font-semibold text-ink"
      >
        {t("provenance")}
      </h2>
      <dl className="num mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-t border-line pt-2">
            <dt className="text-xs text-muted-ink">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-sm font-medium text-ink">{t("disclaimerLabel")}</h3>
        <p className="mt-1 max-w-prose text-sm leading-6 text-muted-ink">
          {disclaimer}
        </p>
      </div>
    </section>
  );
}
