"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
export function useMaterials() {
  return useQuery({
    queryKey: queryKeys.materials(),
    queryFn: () => resources.materials(),
  });
}
export function useForecast(id: string) {
  return useQuery({
    queryKey: queryKeys.forecast(id),
    queryFn: () => resources.forecast(id),
    enabled: !!id,
  });
}
