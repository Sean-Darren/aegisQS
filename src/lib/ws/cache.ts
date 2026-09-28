import type { QueryClient } from "@tanstack/react-query";
import {
  type AnalysisJob,
  type Flag,
  flagFiltersSchema,
  auditorStatusSchema,
  type WsEvent,
} from "@/schemas";
import { queryKeys } from "@/lib/api/query-keys";
export function applyProjectEvent(
  client: QueryClient,
  projectId: string,
  event: WsEvent,
) {
  if (event.type === "flag.created") {
    if (event.flag.projectId !== projectId) return;
    client.setQueryData(queryKeys.flag(event.flag.id), event.flag);
    for (const query of client
      .getQueryCache()
      .findAll({ queryKey: queryKeys.flags(projectId) })) {
      const filters = flagFiltersSchema.safeParse(query.queryKey[3] ?? {});
      if (!filters.success) continue;
      const matches = Object.entries(filters.data).every(
        ([key, value]) =>
          value === undefined ||
          event.flag[key as keyof typeof filters.data] === value,
      );
      client.setQueryData<Flag[]>(query.queryKey, (old) =>
        !old
          ? old
          : matches
            ? [...old.filter((flag) => flag.id !== event.flag.id), event.flag]
            : old.filter((flag) => flag.id !== event.flag.id),
      );
    }
    void client.invalidateQueries({ queryKey: queryKeys.flags(projectId) });
    void client.invalidateQueries({ queryKey: queryKeys.reports(projectId) });
    return;
  }
  const key = queryKeys.job(event.jobId);
  const old = client.getQueryData<AnalysisJob>(key);
  if (old && old.projectId !== projectId) return;
  if (event.type === "job.progress") {
    const status = auditorStatusSchema.safeParse(event.status);
    if (!status.success || !old) {
      void client.invalidateQueries({ queryKey: key });
      return;
    }
    client.setQueryData<AnalysisJob>(key, (job) => {
      if (!job || ["succeeded", "failed", "partial"].includes(job.status))
        return job;
      return {
        ...job,
        status: "running",
        progress: job.progress.map((progress) =>
          progress.tendererId === event.tendererId &&
          progress.auditor === event.auditor
            ? {
                ...progress,
                status: status.data,
                pct: Math.max(progress.pct, event.pct),
              }
            : progress,
        ),
      };
    });
  } else {
    client.setQueryData<AnalysisJob>(key, (job) =>
      job ? { ...job, status: event.status } : job,
    );
    // The completed event contains no finishedAt or result payload: refetch authoritative data.
    void client.invalidateQueries({ queryKey: key });
    void client.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  }
}
