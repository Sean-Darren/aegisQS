"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { DecisionForm, ErrorState, useToast } from "@/components/ui";
import { formatDate, formatFileSize, type FormatLocale } from "@/lib/format";
import { can } from "@/lib/auth/permissions";
import { resources, queryKeys } from "@/lib/api";
import type { DocumentVersion, HubDocument, User } from "@/schemas";
export function ConflictResolution({
  document,
  versions,
  user,
}: {
  document: HubDocument;
  versions: DocumentVersion[];
  user?: User;
}) {
  const t = useTranslations("Hub");
  const locale = useLocale() as FormatLocale;
  const client = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function resolve(versionId: string, reason: string) {
    setPending(true);
    setError(false);
    try {
      await resources.setCurrent(document.id, { versionId, reason });
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.document(document.id) }),
        client.invalidateQueries({
          queryKey: queryKeys.project(document.projectId),
        }),
      ]);
      toast(t("currentSet"), "success");
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="space-y-4 rounded-lg border border-risk bg-risk-bg p-4">
      <h2 className="font-semibold text-risk">{t("conflictTitle")}</h2>
      <p>{t("conflictExplanation")}</p>
      {!can(user, "document.setCurrent") && <p>{t("seniorOnly")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {versions.map((version) => (
          <article
            key={version.id}
            className="space-y-2 rounded-md border border-line bg-panel p-4"
          >
            <h3 className="font-semibold">
              {version.fileName} · {t("rev", { revision: version.label })}
            </h3>
            <dl className="space-y-1 break-all text-xs">
              <dt>{t("hash")}</dt>
              <dd className="tabular-nums">{version.sha256}</dd>
              <dt>{t("size")}</dt>
              <dd className="tabular-nums">
                {formatFileSize(version.sizeBytes)}
              </dd>
              <dt>{t("uploader")}</dt>
              <dd>{version.uploadedBy}</dd>
              <dt>{t("updated")}</dt>
              <dd className="tabular-nums">
                {formatDate(version.uploadedAt, locale)}
              </dd>
            </dl>
            {can(user, "document.setCurrent") && (
              <DecisionForm
                actions={[
                  {
                    value: version.id,
                    label: t("rev", { revision: version.label }),
                  },
                ]}
                actionLabel={t("chooseVersion")}
                reasonLabel={t("reason")}
                submitLabel={t("setCurrent")}
                errorMessage={t("reasonRequired")}
                minReasonLength={1}
                pending={pending}
                onSubmit={({ action, reason }) => resolve(action, reason)}
              />
            )}
          </article>
        ))}
      </div>
      {error && <ErrorState message={t("resolveError")} />}
    </section>
  );
}
