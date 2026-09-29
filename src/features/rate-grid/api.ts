"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";

export function useRateGridData(
  projectId: string,
  filters: { trade?: string; flaggedOnly?: boolean },
) {
  const tenderers = useQuery({
    queryKey: queryKeys.tenderers(projectId),
    queryFn: () => resources.tenderers(projectId),
  });
  const grid = useInfiniteQuery({
    queryKey: queryKeys.rateGrid(projectId, filters),
    queryFn: ({ pageParam }) =>
      resources.rateGrid(projectId, { ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  return { tenderers, grid };
}
