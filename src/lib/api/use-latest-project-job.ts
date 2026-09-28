"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import { resources } from "./resources";

export function useLatestProjectJob(projectId: string) {
  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => resources.project(projectId),
    enabled: !!projectId,
  });
  const jobId = project.data?.latestJobId;
  const job = useQuery({
    queryKey: queryKeys.job(jobId ?? ""),
    queryFn: () => resources.job(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) =>
      query.state.data &&
      ["queued", "running"].includes(query.state.data.status)
        ? 2000
        : false,
  });
  return { project, job };
}
