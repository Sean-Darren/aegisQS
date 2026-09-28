"use client";
import { CircleCheck, Clock3, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  auditorKindSchema,
  type AnalysisJob,
  type AuditorKind,
  type Tenderer,
} from "@/schemas";
import { Button } from "@/components/ui/button";

export function ProgressMatrix({
  job,
  tenderers,
  canRetry,
  onRetry,
}: {
  job: AnalysisJob;
  tenderers: Tenderer[];
  canRetry: boolean;
  onRetry: (tendererId: string, auditor: AuditorKind) => void;
}) {
  const t = useTranslations("Jobs");
  const auditors = useTranslations("Auditors");
  const icons = {
    queued: Clock3,
    running: Clock3,
    succeeded: CircleCheck,
    failed: TriangleAlert,
  };
  const byCell = new Map(
    job.progress.map((item) => [`${item.tendererId}:${item.auditor}`, item]),
  );
  return (
    <section
      aria-labelledby="progress-title"
      aria-live="polite"
      className="mt-6 rounded-lg border border-line bg-panel"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="progress-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="text-sm text-muted-ink">{t(job.status)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-line bg-stone-50 text-xs font-medium text-muted-ink">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("tenderer")}
              </th>
              {auditorKindSchema.options.map((auditor) => (
                <th scope="col" key={auditor} className="px-4 py-3 text-right">
                  {auditors(auditor)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenderers.map((tenderer) => (
              <tr
                key={tenderer.id}
                className="border-b border-line last:border-b-0"
              >
                <th scope="row" className="px-4 py-3 font-medium">
                  {tenderer.name}
                </th>
                {auditorKindSchema.options.map((auditor) => {
                  const cell = byCell.get(`${tenderer.id}:${auditor}`);
                  if (!cell)
                    return (
                      <td
                        key={auditor}
                        className="px-4 py-3 text-right text-muted-ink"
                      >
                        {t("noCell")}
                      </td>
                    );
                  const Icon = icons[cell.status];
                  return (
                    <td key={auditor} className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 ${cell.status === "failed" ? "text-risk" : cell.status === "succeeded" ? "text-tolerance" : "text-muted-ink"}`}
                      >
                        <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
                        <span>{t(cell.status)}</span>
                        <span className="num min-w-9 text-right">
                          {t("progress", { pct: cell.pct })}
                        </span>
                      </span>
                      {cell.error && (
                        <p className="mt-1 text-xs text-risk">{cell.error}</p>
                      )}
                      {cell.status === "failed" && !cell.error && (
                        <p className="mt-1 text-xs text-risk">
                          {t("auditorFailedGeneric")}
                        </p>
                      )}
                      {cell.status === "failed" && canRetry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          aria-label={`${t("retry")}: ${tenderer.name}, ${auditors(auditor)}`}
                          onClick={() => onRetry(tenderer.id, auditor)}
                        >
                          <RefreshCw
                            size={14}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          {t("retry")}
                        </Button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
