"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WsEvent } from "@/schemas";
import { connectProjectSocket } from "./client";
import { applyProjectEvent, refreshProject } from "./cache";
/** The only application socket subscriber; cache updates are independent of page components. */
export function useProjectEvents(
  projectId: string,
  onEvent?: (event: WsEvent) => void,
) {
  const client = useQueryClient();
  const callback = useRef(onEvent);
  useEffect(() => {
    callback.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    if (!projectId) return;
    return connectProjectSocket(projectId, {
      onEvent: (event) => {
        applyProjectEvent(client, projectId, event);
        callback.current?.(event);
      },
      onOpen: () => refreshProject(client, projectId),
      onError: () => refreshProject(client, projectId),
    });
  }, [client, projectId]);
}
