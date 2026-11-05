"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
export function useComparison(id: string) {
  return useQuery({
    queryKey: queryKeys.comparison(id),
    queryFn: () => resources.comparison(id),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data &&
      ["queued", "aligning", "detecting"].includes(query.state.data.status)
        ? 1500
        : false,
  });
}
export function useChanges(id: string) {
  return useQuery({
    queryKey: queryKeys.changes(id),
    queryFn: () => resources.changes(id),
    enabled: !!id,
  });
}
