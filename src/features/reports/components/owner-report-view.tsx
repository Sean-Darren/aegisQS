"use client";
import { useLocale, useTranslations } from "next-intl";
import { RiskBandBadge } from "@/components/ui/status-badges";
import { ErrorState } from "@/components/ui/states";
import { formatCompactCurrency, formatNumber } from "@/lib/format";
import type {
  Bid,
  ComplianceScore,
  Flag,
  Project,
  Report,
  Tenderer,
} from "@/schemas";
import { FlaggedTenderers } from "./flagged-tenderers";
import { ReportProvenance } from "./report-provenance";
import { ReportScoreTable } from "./report-score-table";

export function OwnerReportView({
  token,
  report,
  project,
  tenderers,
  bids,
  scores,
  flags,
  signatoryName,
  notes,
  disclaimer,
}: {
  token: string;
  report: Report;
  project: Project;
  tenderers: Tenderer[];
  bids: Bid[];
  scores: ComplianceScore[];
  flags: Flag[];
  signatoryName: string;
  notes: string;
  disclaimer: string;
}) {
  const t = useTranslations("OwnerPortal");
  const locale = useLocale();
  if (report.status !== "signed")
    return <ErrorState message={t("signedOnly")} />;
  const recommended = tenderers.find(
    (item) => item.id === report.recommendedTendererId,
  );
  const score = scores.find(
    (item) => item.tendererId === report.recommendedTendererId,
  );
  const bid = bids.find(
    (item) => item.tendererId === report.recommendedTendererId,
  );
  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-lg font-semibold">{t("product")}</p>
            <p className="text-sm text-muted-ink">{t("readOnly")}</p>
          </div>
          <nav aria-label={t("language")} className="flex gap-2 text-sm">
            <a
              href={`/en/shared/${encodeURIComponent(token)}`}
              aria-current={locale === "en" ? "page" : undefined}
              className="rounded-md border border-line-strong px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 aria-[current=page]:bg-stone-50"
            >
              {t("english")}
            </a>
            <a
              href={`/zh-HK/shared/${encodeURIComponent(token)}`}
              aria-current={locale === "zh-HK" ? "page" : undefined}
              className="rounded-md border border-line-strong px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 aria-[current=page]:bg-stone-50"
            >
              {t("chinese")}
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 text-base sm:px-8">
        <div>
          <p className="text-sm text-muted-ink">{t("signedReport")}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">
            {project.name}
          </h1>
          <p className="num mt-2 text-sm text-muted-ink">
            {t("version", { version: report.version })}
          </p>
        </div>
        <section
          aria-labelledby="owner-summary-title"
          className="rounded-lg border border-line bg-panel p-5"
        >
          <h2 id="owner-summary-title" className="text-lg font-semibold">
            {t("summary")}
          </h2>
          <p className="mt-3 max-w-prose leading-7">
            {recommended
              ? t("summaryRecommendation", { tenderer: recommended.name })
              : t("noRecommendation")}
          </p>
          {score && (
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
              <p className="num text-2xl font-semibold">
                {formatNumber(score.score)} / 100
              </p>
              <RiskBandBadge band={score.band} />
              {bid && (
                <p className="num text-right text-base text-muted-ink">
                  {t("bidValue", {
                    value: formatCompactCurrency(bid.totalValueHKD),
                  })}
                </p>
              )}
            </div>
          )}
          {report.overrideReason && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="font-medium">{t("overrideReason")}</h3>
              <p className="mt-1 max-w-prose leading-7">
                {report.overrideReason}
              </p>
            </div>
          )}
        </section>
        <section
          aria-labelledby="owner-notes-title"
          className="rounded-lg border border-line bg-panel p-5"
        >
          <h2 id="owner-notes-title" className="text-lg font-semibold">
            {t("auditorNotes")}
          </h2>
          <p className="mt-1 text-sm text-muted-ink">{t("generatedLabel")}</p>
          <p className="mt-3 max-w-prose whitespace-pre-wrap leading-7">
            {notes || t("noNotes")}
          </p>
        </section>
        <div className="[&_table]:text-base">
          <ReportScoreTable scores={scores} tenderers={tenderers} bids={bids} />
        </div>
        <div className="[&_li]:text-base">
          <FlaggedTenderers
            flags={flags}
            tenderers={tenderers}
            inlineEvidence
          />
        </div>
        <ReportProvenance
          report={report}
          signatoryName={signatoryName}
          disclaimer={disclaimer}
        />
      </main>
    </div>
  );
}
