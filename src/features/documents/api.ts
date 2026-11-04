"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: queryKeys.documents(projectId),
    queryFn: () => resources.documents(projectId),
    enabled: !!projectId,
  });
}
