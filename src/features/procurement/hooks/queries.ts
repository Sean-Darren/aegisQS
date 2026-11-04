"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
export function useProcurement(projectId: string) {
  const needs = useQuery({
    queryKey: queryKeys.materialNeeds(projectId),
    queryFn: () => resources.materialNeeds(projectId),
    enabled: !!projectId,
  });
  const advice = useQuery({
    queryKey: queryKeys.procurement(projectId),
    queryFn: () => resources.procurement(projectId),
    enabled: !!projectId,
  });
  return { needs, advice };
}
