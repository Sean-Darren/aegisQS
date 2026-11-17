"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Actor,
  Button,
  ErrorState,
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { PdfViewer } from "@/components/viewer";
import { useDocument, useFile } from "@/lib/api/use-records";
import { resources, queryKeys } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  formatDate,
  formatRevisionLabel,
  type FormatLocale,
} from "@/lib/format";
import { LinkedRecords } from "@/components/records/linked-records";
import { EntityActivity } from "@/components/records/entity-activity";
import { ConflictResolution } from "./conflict-resolution";
import { UploadQueue } from "./upload-queue";
import type { DocumentVersion } from "@/schemas";
function Preview({
  version,
  projectId,
}: {
  version: DocumentVersion;
  projectId: string;
}) {
  const t = useTranslations("Hub");
  const file = useFile(version.id);
  if (
    version.mimeType.includes("spreadsheet") ||
    version.fileName.endsWith(".xlsx")
  )
    return (
      <Link
        className="text-clay-700 underline"
        href={`/projects/${projectId}/workbooks?version=${version.id}`}
      >
        {t("openWorkbooks")}
      </Link>
    );
  if (file.isPending) return <Skeleton className="h-64 w-full" />;
  if (file.isError) return <ErrorState message={t("previewError")} />;
  if (version.mimeType.includes("pdf") && file.data)
    return (
      <div className="h-[460px] overflow-auto">
        <PdfViewer
          file={file.data}
          page={1}
          zoom={1}
          loading={t("loading")}
          error={t("previewError")}
        />
      </div>
    );
  if (version.mimeType.startsWith("image/") && file.data)
    return (
      <div className="overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={(node) => {
            if (!node || !file.data) return;
            const url = URL.createObjectURL(file.data);
            node.src = url;
            return () => URL.revokeObjectURL(url);
          }}
          alt={version.fileName}
          className="max-h-[460px] max-w-full object-contain"
        />
      </div>
    );
  return <p>{t("noPreview")}</p>;
}
export function DocumentDetail({
  documentId,
  versionId,
}: {
  documentId: string;
  versionId?: string;
}) {
  const t = useTranslations("Hub");
  const locale = useLocale() as FormatLocale;
  const session = useSession();
  const query = useDocument(documentId);
  const conflicts = useQuery({
    queryKey: queryKeys.conflicts(documentId),
    queryFn: () => resources.conflicts(documentId),
  });
  const [selected, setSelected] = useState<string>();
  const [downloadError, setDownloadError] = useState(false);
  const doc = query.document.data;
  const versions = query.versions.data ?? [];
  const active = versions.find(
    (v) => v.id === (selected ?? versionId ?? doc?.currentVersionId),
  );
  async function download() {
    if (!active) return;
    setDownloadError(false);
    try {
      const blob = await resources.documentFile(active.id);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = active.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(true);
    }
  }
  if (query.document.isPending || query.versions.isPending)
    return <Skeleton className="h-96 w-full" />;
  if (query.document.isError || query.versions.isError || !doc)
    return <ErrorState message={t("error")} />;
  const current = versions.find((v) => v.id === doc.currentVersionId);
  const conflictingIds = new Set(
    (conflicts.data ?? [])
      .filter((c) => !c.resolution)
      .flatMap((c) => c.versionIds),
  );
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          {doc.docNumber} · {doc.title}
        </h1>
      </header>
      {doc.hasConflict && (
        <ConflictResolution
          document={doc}
          versions={versions.filter((v) => conflictingIds.has(v.id))}
          user={session.data}
        />
      )}
      {conflicts.isError && <ErrorState message={t("resolveError")} />}
      {downloadError && <ErrorState message={t("downloadError")} />}
      {active && active.id !== doc.currentVersionId && (
        <div className="rounded-md border border-line bg-stone-50 p-3">
          <p>{t("superseded", { revision: current?.label ?? "…" })}</p>
          <Button
            variant="ghost"
            onClick={() => setSelected(doc.currentVersionId)}
          >
            {t("viewCurrent")}
          </Button>
        </div>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("timeline")}</h2>
        <ol className="space-y-2">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setSelected(v.id)}
                className={`flex w-full flex-wrap items-center gap-3 rounded-md border p-3 text-left focus-visible:outline-2 focus-visible:outline-clay-600 ${active?.id === v.id ? "border-clay-600 bg-limewash-100" : "border-line bg-panel"}`}
              >
                <span>{formatRevisionLabel(v.label)}</span>
                <StatusChip
                  domain="versionStatus"
                  value={
                    v.id === doc.currentVersionId
                      ? "current"
                      : v.status === "conflict"
                        ? "conflict"
                        : "superseded"
                  }
                />
                <span className="text-xs text-muted-ink">
                  {v.fileName} · <Actor value={v.uploadedBy} /> ·{" "}
                  <span className="tabular-nums">
                    {formatDate(v.uploadedAt, locale)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      {active && (
        <section className="space-y-3">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">{t("preview")}</h2>
            <Button variant="outline" onClick={() => void download()}>
              {t("download")}
            </Button>
          </div>
          <Preview key={active.id} version={active} projectId={doc.projectId} />
          <LinkedRecords
            projectId={doc.projectId}
            type="document_version"
            id={active.id}
          />
        </section>
      )}
      {can(session.data, "document.upload") && (
        <UploadQueue projectId={doc.projectId} fixedDocument={doc} />
      )}
      <EntityActivity
        projectId={doc.projectId}
        entities={[
          { type: "document", id: doc.id },
          ...versions.map((v) => ({
            type: "document_version" as const,
            id: v.id,
          })),
        ]}
      />
    </div>
  );
}
