"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";

export function useAuditEvents(projectId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.auditEvents(projectId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => resources.auditEvents(projectId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!projectId,
  });
}
