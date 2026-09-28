"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AnalysisJob } from "@/schemas";
import { queryKeys } from "@/lib/api/query-keys";
import { applyProjectEvent } from "./cache";
import { connectProjectSocket } from "./client";
/** Mount under a QueryClientProvider. Owns connection cleanup when the project changes. */
export function useProjectEvents(projectId: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (!projectId) return;
    return connectProjectSocket(projectId, {
      onEvent: (event) => applyProjectEvent(client, projectId, event),
      onOpen: () => {
        void client.invalidateQueries({
          queryKey: queryKeys.jobs(),
          predicate: (query) =>
            (query.state.data as AnalysisJob | undefined)?.projectId ===
            projectId,
        });
        void client.invalidateQueries({
          queryKey: queryKeys.project(projectId),
        });
      },
      onError: () => {
        void client.invalidateQueries({
          queryKey: queryKeys.project(projectId),
        });
      },
    });
  }, [client, projectId]);
}
