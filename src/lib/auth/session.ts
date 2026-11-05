"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
import type { Role } from "@/schemas";
export function useSession() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: resources.me,
    staleTime: 30_000,
    retry: false,
  });
}
export function useMockRoleSwitcher() {
  const client = useQueryClient();
  return async (role: Role) => {
    if (process.env.NEXT_PUBLIC_API_MOCKING !== "enabled") return;
    const { setMockRole } = await import("@/mocks/store");
    setMockRole(role);
    await client.invalidateQueries();
  };
}
