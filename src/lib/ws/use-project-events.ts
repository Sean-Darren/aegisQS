"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AnalysisJob, WsEvent } from "@/schemas";
import { queryKeys } from "@/lib/api/query-keys";
import { applyProjectEvent } from "./cache";
import { connectProjectSocket } from "./client";
/** Mount under a QueryClientProvider. Owns connection cleanup when the project changes. */
export function useProjectEvents(
  projectId: string,
  options?: {
    onCompleted?: (event: Extract<WsEvent, { type: "job.completed" }>) => void;
  },
) {
  const client = useQueryClient();
  const completed = useRef(options?.onCompleted);
  useEffect(() => {
    completed.current = options?.onCompleted;
  }, [options?.onCompleted]);
  useEffect(() => {
    if (!projectId) return;
    return connectProjectSocket(projectId, {
      onEvent: (event) => {
        applyProjectEvent(client, projectId, event);
        if (event.type === "job.completed") completed.current?.(event);
      },
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
