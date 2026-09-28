"use client";
import { useState } from "react";
import { CircleCheck, Clock3, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectDocument, Tenderer } from "@/schemas";
import { Button } from "@/components/ui/button";

export function DocumentIndex({
  documents,
  tenderers,
  canReprocess,
  onReprocess,
}: {
  documents: ProjectDocument[];
  tenderers: Tenderer[];
  canReprocess: boolean;
  onReprocess: (documentId: string) => Promise<void>;
}) {
  const t = useTranslations("Documents");
  const types = useTranslations("DocumentTypes");
  const [busyId, setBusyId] = useState<string>();
  const [errorId, setErrorId] = useState<string>();
  const names = new Map(tenderers.map((item) => [item.id, item.name]));
  async function reprocess(id: string) {
    setBusyId(id);
    setErrorId(undefined);
    try {
      await onReprocess(id);
    } catch {
      setErrorId(id);
    } finally {
      setBusyId(undefined);
    }
  }
  const icons = {
    queued: Clock3,
    parsing: Clock3,
    parsed: CircleCheck,
    failed: TriangleAlert,
  };
  return (
    <section
      className="mt-6 rounded-lg border border-line bg-panel"
      aria-labelledby="document-index-title"
    >
      <h2
        id="document-index-title"
        className="border-b border-line px-5 py-4 text-lg font-semibold"
      >
        {t("indexTitle")}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line bg-stone-50 text-xs font-medium text-muted-ink">
            <tr>
              {[
                "file",
                "type",
                "tenderer",
                "version",
                "pages",
                "parseStatus",
                "error",
              ].map((key) => (
                <th
                  key={key}
                  scope="col"
                  className={`px-4 py-3 ${key === "version" || key === "pages" ? "text-right" : ""}`}
                >
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => {
              const Icon = icons[document.parseStatus];
              return (
                <tr
                  key={document.id}
                  className="border-b border-line last:border-b-0 hover:bg-surface"
                >
                  <td className="max-w-64 break-all px-4 py-3 font-medium">
                    <a
                      href={`/api/v1/documents/${encodeURIComponent(document.id)}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-sm text-clay-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                    >
                      {document.fileName}
                    </a>
                  </td>
                  <td className="px-4 py-3">{types(document.type)}</td>
                  <td className="px-4 py-3">
                    {document.tendererId
                      ? (names.get(document.tendererId) ?? document.tendererId)
                      : t("noError")}
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {document.version}
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {document.pageCount ?? t("noError")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 ${document.parseStatus === "failed" ? "text-risk" : document.parseStatus === "parsed" ? "text-tolerance" : "text-muted-ink"}`}
                    >
                      <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
                      {t(document.parseStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {document.parseError && (
                      <p className="text-risk">{document.parseError}</p>
                    )}
                    {document.parseStatus === "failed" &&
                      !document.parseError && (
                        <p className="text-risk">{t("parseFailedGeneric")}</p>
                      )}
                    {errorId === document.id && (
                      <p role="alert" className="text-risk">
                        {t("reprocessFailed")}
                      </p>
                    )}
                    {document.parseStatus === "failed" && canReprocess && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === document.id}
                        onClick={() => void reprocess(document.id)}
                      >
                        <RefreshCw
                          size={14}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        {t("reprocess")}
                      </Button>
                    )}
                    {!document.parseError &&
                      document.parseStatus !== "failed" &&
                      t("noError")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
