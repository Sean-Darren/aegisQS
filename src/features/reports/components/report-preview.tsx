"use client";
import { useTranslations } from "next-intl";
import type { Bid, ComplianceScore, Flag, Report, Tenderer } from "@/schemas";
import { AuditorNotes } from "./auditor-notes";
import { FlaggedTenderers } from "./flagged-tenderers";
import { RecommendationEditor } from "./recommendation-editor";
import { ReportProvenance } from "./report-provenance";
import { ReportScoreTable } from "./report-score-table";

export function ReportPreview({
  report,
  projectName,
  tenderers,
  bids,
  scores,
  flags,
  defaultTendererId,
  recommendedTendererId,
  overrideReason,
  notes,
  disclaimer,
  signatoryName,
  editable,
  onRecommendedTendererChange,
  onOverrideReasonChange,
  onNotesChange,
  onOpenEvidence,
}: {
  report: Report;
  projectName: string;
  tenderers: Tenderer[];
  bids: Bid[];
  scores: ComplianceScore[];
  flags: Flag[];
  defaultTendererId?: string;
  recommendedTendererId: string;
  overrideReason: string;
  notes: string;
  disclaimer: string;
  signatoryName?: string;
  editable: boolean;
  onRecommendedTendererChange: (value: string) => void;
  onOverrideReasonChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onOpenEvidence: (flagId: string) => void;
}) {
  const t = useTranslations("Reports");
  const canEdit = editable && report.status === "draft";
  return (
    <article className="space-y-5">
      <header>
        <p className="num text-sm text-muted-ink">
          {report.status === "signed"
            ? t("signedPreview", { version: report.version })
            : t("draftPreview", { version: report.version })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {projectName}
        </h1>
      </header>
      <RecommendationEditor
        tenderers={tenderers}
        recommendedTendererId={recommendedTendererId}
        defaultTendererId={defaultTendererId}
        overrideReason={overrideReason}
        editable={canEdit}
        onRecommendedTendererChange={onRecommendedTendererChange}
        onOverrideReasonChange={onOverrideReasonChange}
      />
      <ReportScoreTable scores={scores} tenderers={tenderers} bids={bids} />
      <FlaggedTenderers
        flags={flags}
        tenderers={tenderers}
        onOpenEvidence={onOpenEvidence}
      />
      <AuditorNotes notes={notes} editable={canEdit} onChange={onNotesChange} />
      <ReportProvenance
        report={report}
        signatoryName={signatoryName}
        disclaimer={disclaimer}
      />
    </article>
  );
}
