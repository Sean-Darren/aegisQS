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
    refetchInterval: (query) =>
      (query.state.data ?? []).some(
        (d) =>
          d.latestComparison &&
          ["queued", "aligning", "detecting"].includes(
            d.latestComparison.status,
          ),
      )
        ? 2000
        : 15000,
  });
  const workbooks = useQuery({
    queryKey: queryKeys.workbooks(projectId ?? ""),
    queryFn: () => resources.workbooks(projectId!),
    enabled: !!projectId,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((w) => !w.currentVersionId) ? 3000 : 15000,
  });
  const versions = useQueries({
    queries: (workbooks.data ?? [])
      .filter((w) => !!w.currentVersionId)
      .map((w) => ({
        queryKey: queryKeys.workbookVersion(w.currentVersionId!),
        queryFn: () => resources.workbookVersion(w.currentVersionId!),
        refetchInterval: (query: {
          state: { data?: { status: string } | undefined };
        }) =>
          query.state.data &&
          ["queued", "parsing", "checking"].includes(query.state.data.status)
            ? 2000
            : false,
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
