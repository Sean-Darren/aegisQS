"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";

export function useEvidenceDocument(documentId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.documentFile(documentId),
    queryFn: () => resources.documentFile(documentId),
    enabled: enabled && !!documentId,
    staleTime: Infinity,
  });
}

export function useFlagActivity(projectId: string, flagId: string) {
  return useQuery({
    queryKey: [...queryKeys.auditEvents(projectId), "flag", flagId],
    enabled: !!projectId && !!flagId,
    queryFn: async () => {
      const events = [];
      let cursor: string | undefined;
      do {
        const page = await resources.auditEvents(projectId, cursor);
        events.push(
          ...page.data.filter(
            (event) => event.entityType === "flag" && event.entityId === flagId,
          ),
        );
        cursor = page.nextCursor;
      } while (cursor);
      return events;
    },
  });
}
