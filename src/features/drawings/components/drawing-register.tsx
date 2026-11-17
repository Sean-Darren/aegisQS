"use client";
import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";

import { queryKeys, resources } from "@/lib/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  ErrorState,
  EmptyState,
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { UploadQueue } from "@/features/documents/components/upload-queue";
import { ComparisonDialog } from "./comparison-dialog";
import type { DrawingRegisterEntry } from "@/schemas";
function DrawingRow({
  entry,
  onCompare,
}: {
  entry: DrawingRegisterEntry;
  onCompare: (comparisonId: string) => void;
}) {
  const t = useTranslations("Drawing");
  const params = useSearchParams();
  const client = useQueryClient();
  const session = useSession();
  const doc = entry.document;
  const versions = useQuery({
    queryKey: queryKeys.versions(doc.id),
    queryFn: () => resources.versions(doc.id),
  });
  const changes = useQuery({
    queryKey: queryKeys.changes(entry.latestComparison?.id ?? ""),
    queryFn: () => resources.changes(entry.latestComparison!.id),
    enabled: !!entry.latestComparison,
  });
  const list = versions.data ?? [];
  const current = list.find((v) => v.id === doc.currentVersionId);
  const previous = list.find(
    (v) => v.id !== doc.currentVersionId && v.status !== "conflict",
  );
  const matched = params.get("document") === doc.id;
  const [base, setBase] = useState<string>();
  const [target, setTarget] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const baseId =
      base ?? (matched ? params.get("base") : undefined) ?? previous?.id ?? "",
    targetId =
      target ??
      (matched ? params.get("target") : undefined) ??
      current?.id ??
      "";
  async function compare() {
    setPending(true);
    setError(false);
    try {
      const comparison = await resources.runComparison(doc.projectId, {
        documentId: doc.id,
        baseVersionId: baseId,
        targetVersionId: targetId,
      });
      client.setQueryData(queryKeys.comparison(comparison.id), comparison);
      void client.invalidateQueries({
        queryKey: queryKeys.drawings(doc.projectId),
      });
      onCompare(comparison.id);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="space-y-4 rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {doc.docNumber} · {doc.title}
          </h2>
          <p className="text-xs text-muted-ink">
            {doc.discipline ? t(`disciplines.${doc.discipline}`) : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 rounded-md border border-line p-2 text-xs"
            >
              {t("rev", { revision: v.label })}
              {v.id === doc.currentVersionId && (
                <StatusChip domain="versionStatus" value="current" compact />
              )}
            </span>
          ))}
          {can(session.data, "document.upload") && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">{t("uploadRevision")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>
                  {t("uploadRevisionFor", { number: doc.docNumber })}
                </DialogTitle>
                <UploadQueue projectId={doc.projectId} fixedDocument={doc} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      {entry.latestComparison && (
        <p className="text-sm">
          <button
            type="button"
            className="rounded-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            onClick={() => onCompare(entry.latestComparison!.id)}
          >
            {t("latest", {
              count: Object.values(entry.latestComparison.changeCounts).reduce(
                (a, b) => a + b,
                0,
              ),
              unreviewed:
                changes.data?.filter((c) => c.status === "new").length ?? 0,
            })}
          </button>{" "}
          · {t(`jobs.${entry.latestComparison.status}`)}
        </p>
      )}
      {can(session.data, "comparison.run") && (
        <div className="flex flex-wrap items-end gap-3">
          <label>
            {t("base")}
            <select
              aria-label={`${doc.docNumber} ${t("base")}`}
              value={baseId}
              onChange={(e) => setBase(e.target.value)}
              className={inputStyle}
            >
              {list.map((v) => (
                <option value={v.id} key={v.id}>
                  {t("rev", { revision: v.label })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("target")}
            <select
              aria-label={`${doc.docNumber} ${t("target")}`}
              value={targetId}
              onChange={(e) => setTarget(e.target.value)}
              className={inputStyle}
            >
              {list.map((v) => (
                <option value={v.id} key={v.id}>
                  {t("rev", { revision: v.label })}
                </option>
              ))}
            </select>
          </label>
          <span
            title={!baseId || baseId === targetId ? t("chooseTwo") : undefined}
          >
            <Button
              disabled={pending || !baseId || baseId === targetId}
              onClick={() => void compare()}
            >
              {t("compare")}
            </Button>
          </span>
        </div>
      )}
      {error && <ErrorState message={t("error")} />}
    </article>
  );
}
export function DrawingRegister({ projectId }: { projectId: string }) {
  const t = useTranslations("Drawing");
  const session = useSession();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [compareId, setCompareId] = useState<string>();
  const query = useQuery({
    queryKey: queryKeys.drawings(projectId),
    queryFn: () => resources.drawings(projectId),
  });
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("register")}</h1>
          <p className="mt-2 text-sm text-muted-ink">{t("uploadHint")}</p>
        </div>
        {can(session.data, "document.upload") && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload size={16} strokeWidth={2} aria-hidden="true" />
            {t("uploadDrawing")}
          </Button>
        )}
      </header>
      {query.isPending && <Skeleton className="h-96 w-full" />}
      {query.isError && <ErrorState message={t("error")} />}
      {query.data?.length === 0 && (
        <EmptyState
          message={t("empty")}
          action={
            can(session.data, "document.upload")
              ? {
                  label: t("uploadDrawing"),
                  onClick: () => setUploadOpen(true),
                }
              : undefined
          }
        />
      )}
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        {query.data?.map((entry) => (
          <DrawingRow
            key={entry.document.id}
            entry={entry}
            onCompare={setCompareId}
          />
        ))}
      </Suspense>
      {compareId && (
        <ComparisonDialog
          comparisonId={compareId}
          onOpenChange={(open) => {
            if (!open) setCompareId(undefined);
          }}
        />
      )}
      {uploadOpen && can(session.data, "document.upload") && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setUploadOpen(false);
          }}
        >
          <DialogContent className="max-h-[85vh] space-y-4 overflow-y-auto">
            <DialogTitle className="pr-7 text-xl font-semibold">
              {t("uploadDrawing")}
            </DialogTitle>
            <DialogDescription>{t("uploadDescription")}</DialogDescription>
            <UploadQueue projectId={projectId} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
