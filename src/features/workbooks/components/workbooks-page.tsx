"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resources, queryKeys } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { formatDate, type FormatLocale } from "@/lib/format";
import {
  Button,
  StatusChip,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { WorkbookUpload } from "./upload";
import { useVersion } from "../hooks/queries";
import type { Workbook } from "@/schemas";
export function CheckSummary({
  summary,
}: {
  summary?: { errors: number; warnings: number; info: number };
}) {
  return (
    <div className="flex gap-2 tabular-nums">
      {(["error", "warning", "info"] as const).map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1">
          <StatusChip domain="checkSeverity" value={s} />
          {summary
            ? summary[(["errors", "warnings", "info"] as const)[i]]
            : "—"}
        </span>
      ))}
    </div>
  );
}
function Row({ workbook }: { workbook: Workbook }) {
  const t = useTranslations("Workbooks");
  const locale = useLocale() as FormatLocale;
  const v = useVersion(workbook.currentVersionId ?? "");
  const session = useSession();
  return (
    <tr className="border-t border-line">
      <th scope="row" className="p-3 text-left">
        <Link
          className="text-clay-700 underline"
          href={`/projects/${workbook.projectId}/workbooks/${workbook.id}`}
        >
          {workbook.name}
        </Link>
      </th>
      <td className="p-3">{t(`kinds.${workbook.kind}`)}</td>
      <td className="p-3 text-right">{v.data?.versionNumber ?? "—"}</td>
      <td className="p-3">
        {v.data ? formatDate(v.data.uploadedAt, locale) : "—"}
      </td>
      <td className="p-3">
        <CheckSummary summary={v.data?.checkSummary} />
        {v.data && <p role="status">{t(`states.${v.data.status}`)}</p>}
        {v.isError && <ErrorState message={t("error")} />}
      </td>
      <td className="p-3">
        {can(session.data, "workbook.upload") && (
          <Link
            className="text-clay-700 underline"
            href={`/projects/${workbook.projectId}/workbooks/${workbook.id}?upload=1`}
          >
            {t("uploadVersion")}
          </Link>
        )}
      </td>
    </tr>
  );
}
export function WorkbooksPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Workbooks");
  const query = useQuery({
    queryKey: queryKeys.workbooks(projectId),
    queryFn: () => resources.workbooks(projectId),
  });
  const session = useSession();
  const [upload, setUpload] = useState(false);
  return (
    <div className="space-y-5">
      <header className="flex justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {can(session.data, "workbook.upload") && (
          <Button onClick={() => setUpload((v) => !v)}>{t("upload")}</Button>
        )}
      </header>
      {upload && can(session.data, "workbook.upload") && (
        <WorkbookUpload projectId={projectId} />
      )}
      {query.isPending && <Skeleton className="h-64 w-full" />}
      {query.isError && <ErrorState message={t("error")} />}
      {query.data?.length === 0 && <EmptyState message={t("empty")} />}
      {!!query.data?.length && (
        <div className="overflow-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-stone-50">
              <tr>
                {[
                  "name",
                  "kind",
                  "version",
                  "uploaded",
                  "summary",
                  "actions",
                ].map((k) => (
                  <th scope="col" className="p-3 text-left" key={k}>
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((w) => (
                <Row key={w.id} workbook={w} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
