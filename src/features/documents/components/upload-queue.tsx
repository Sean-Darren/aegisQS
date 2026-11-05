"use client";
import { useRouter } from "@/i18n/navigation";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { resources, queryKeys } from "@/lib/api";
import { useProjectDocuments } from "@/lib/api/use-records";
import { Dropzone, ErrorState, useToast } from "@/components/ui";
import { UploadForm, type UploadFields } from "./upload-form";
import type { HubDocument } from "@/schemas";
type Entry = {
  id: number;
  file: File;
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
};
export function UploadQueue({
  projectId,
  fixedDocument,
}: {
  projectId: string;
  fixedDocument?: HubDocument;
}) {
  const t = useTranslations("Hub");
  const client = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const records = useProjectDocuments(projectId);
  const sequence = useRef(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const update = (id: number, patch: Partial<Entry>) =>
    setEntries((list) =>
      list.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  async function submit(entry: Entry, fields: UploadFields) {
    update(entry.id, { status: "uploading", progress: 0, error: undefined });
    try {
      const previous = records.documents.data?.find(
        (d) => d.docNumber.toLowerCase() === fields.docNumber.toLowerCase(),
      );
      const oldVersion = records.allVersions.find(
        (v) => v.id === previous?.currentVersionId,
      );
      const form = new FormData();
      form.set("file", entry.file);
      for (const [key, value] of Object.entries(fields))
        if (value) form.set(key, value);
      const options = {
        onProgress: (progress: number) => update(entry.id, { progress }),
      };
      const destination = fixedDocument ?? previous;
      const doc = destination
        ? (await resources.uploadVersion(destination.id, form, options),
          await resources.document(destination.id))
        : await resources.uploadDocument(projectId, form, options);
      update(entry.id, { status: "done", progress: 100 });
      await client.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
      await client.invalidateQueries({
        queryKey: queryKeys.documents(projectId),
      });
      await client.invalidateQueries({ queryKey: queryKeys.document(doc.id) });
      await client.invalidateQueries({ queryKey: queryKeys.versions(doc.id) });
      await client.invalidateQueries({ queryKey: queryKeys.drawings(projectId) });
      if (
        doc.category === "drawing" &&
        previous &&
        oldVersion &&
        !doc.hasConflict
      ) {
        toast(t("drawingAdded"), "success", {
          label: t("compareWith", { revision: oldVersion.label }),
          onClick: () => {
            void (async () => {
              const entries = await resources.drawings(projectId);
              const active = entries.find(
                (e) => e.document.id === doc.id,
              )?.latestComparison;
              const comparison =
                active?.baseVersionId === oldVersion.id &&
                active?.targetVersionId === doc.currentVersionId
                  ? active
                  : await resources.runComparison(projectId, {
                      documentId: doc.id,
                      baseVersionId: oldVersion.id,
                      targetVersionId: doc.currentVersionId!,
                    });
              router.push(
                `/projects/${projectId}/drawings/compare/${comparison.id}`,
              );
            })().catch(() => toast(t("uploadError"), "error"));
          },
        });
      } else toast(t("uploaded"), "success");
    } catch (error) {
      update(entry.id, {
        status: "error",
        error: error instanceof Error ? error.message : t("uploadError"),
      });
    }
  }
  return (
    <section className="space-y-4" aria-label={t("upload")}>
      <Dropzone
        label={t("upload")}
        onFiles={(files) =>
          setEntries((list) => [
            ...list,
            ...files.map((file) => ({
              id: ++sequence.current,
              file,
              progress: 0,
              status: "ready" as const,
            })),
          ])
        }
      />
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="space-y-3 rounded-lg border border-line bg-panel p-5"
        >
          {entry.status === "done" ? (
            <p role="status">
              {entry.file.name} · {t("uploaded")}
            </p>
          ) : (
            <UploadForm
              file={entry.file}
              documents={records.documents.data ?? []}
              versions={records.allVersions}
              fixedDocument={fixedDocument}
              pending={entry.status === "uploading"}
              onSubmit={(fields) => submit(entry, fields)}
            />
          )}
          {entry.status === "uploading" && (
            <div role="status" aria-live="polite">
              <label className="text-sm tabular-nums">
                {t("progress", { pct: entry.progress })}
                <progress
                  className="block w-full accent-clay-700"
                  value={entry.progress}
                  max={100}
                />
              </label>
            </div>
          )}
          {entry.error && (
            <ErrorState message={`${t("uploadError")} ${entry.error}`} />
          )}
        </div>
      ))}
    </section>
  );
}
