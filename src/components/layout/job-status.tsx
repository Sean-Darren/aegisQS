"use client";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys, resources } from "@/lib/api";
export function JobStatus({ projectId }: { projectId?: string }) {
  const t = useTranslations("Drawing");
  const shell = useTranslations("Shell");
  const drawings = useQuery({
    queryKey: queryKeys.drawings(projectId ?? ""),
    queryFn: () => resources.drawings(projectId!),
    enabled: !!projectId,
    refetchInterval: 2000,
  });
  const workbooks = useQuery({
    queryKey: queryKeys.workbooks(projectId ?? ""),
    queryFn: () => resources.workbooks(projectId!),
    enabled: !!projectId,
    refetchInterval: 3000,
  });
  const versions = useQueries({
    queries: (workbooks.data ?? [])
      .filter((w) => !!w.currentVersionId)
      .map((w) => ({
        queryKey: queryKeys.workbookVersion(w.currentVersionId!),
        queryFn: () => resources.workbookVersion(w.currentVersionId!),
        refetchInterval: 2000,
      })),
  });
  const active = drawings.data
    ?.map((d) => d.latestComparison)
    .find((c) => c && ["queued", "aligning", "detecting"].includes(c.status));
  return (
    <span className="tabular-nums text-right">
      {active
        ? t("jobStatus", {
            status: t(`jobs.${active.status}`),
            pct: active.progressPct,
          })
        : versions.some(
              (q) => q.data && ["parsing", "checking"].includes(q.data.status),
            )
          ? t("workbookRunning")
          : shell("jobPlaceholder")}
    </span>
  );
}
