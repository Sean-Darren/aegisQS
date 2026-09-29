"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import type { Evidence } from "@/schemas";
import { useEvidenceDocument } from "../api";

const EvidencePdf = dynamic(
  () => import("./evidence-pdf").then((module) => module.EvidencePdf),
  { ssr: false },
);

export function EvidenceViewer({ evidence }: { evidence: Evidence }) {
  const t = useTranslations("Evidence");
  const [zoom, setZoom] = useState(1);
  const pdf = useEvidenceDocument(evidence.documentId, !!evidence.page);
  if (!evidence.page) {
    if (!evidence.boqItemRef) return <ErrorState message={t("noPage")} />;
    return (
      <div className="overflow-x-auto rounded-md border border-line bg-panel">
        <table className="num w-full text-sm">
          <caption className="border-b border-line bg-stone-50 px-3 py-2 text-left font-medium">
            {t("boqRow")}
          </caption>
          <thead className="bg-stone-50 text-xs text-muted-ink">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                {t("boqItem")}
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                {t("excerpt")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-t border-line px-3 py-2 font-semibold">
                {evidence.boqItemRef}
              </td>
              <td className="border-t border-line px-3 py-2">
                {evidence.excerpt}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (pdf.isPending) return <Skeleton className="h-[440px] w-full" />;
  if (pdf.isError)
    return (
      <ErrorState
        message={t("pdfError")}
        action={{ label: t("retryPdf"), onClick: () => void pdf.refetch() }}
      />
    );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="num text-xs text-muted-ink">
          {t("page", { page: evidence.page })}
        </p>
        <div
          role="group"
          aria-label={t("zoom")}
          className="flex items-center gap-2"
        >
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t("zoomOut")}
            disabled={zoom <= 0.6}
            onClick={() =>
              setZoom((value) => Math.max(0.6, +(value - 0.2).toFixed(1)))
            }
          >
            <Minus size={16} aria-hidden="true" />
          </Button>
          <span className="num min-w-12 text-right text-xs">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t("zoomIn")}
            disabled={zoom >= 1.8}
            onClick={() =>
              setZoom((value) => Math.min(1.8, +(value + 0.2).toFixed(1)))
            }
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <EvidencePdf
        file={pdf.data}
        page={evidence.page}
        bbox={evidence.bbox}
        zoom={zoom}
        loading={t("pdfLoading")}
        error={t("pdfError")}
      />
    </div>
  );
}
