"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resources, queryKeys } from "@/lib/api";
import type { Workbook } from "@/schemas";
export function useWorkbook(id: string) {
  return useQuery({
    queryKey: queryKeys.workbook(id),
    queryFn: () => resources.workbook(id),
  });
}
export function useVersion(id: string) {
  return useQuery({
    queryKey: queryKeys.workbookVersion(id),
    queryFn: () => resources.workbookVersion(id),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data && ["parsing", "checking"].includes(q.state.data.status)
        ? 1000
        : false,
  });
}
export function useVersions(wb?: Workbook) {
  const client = useQueryClient();
  return useQuery({
    queryKey: [...queryKeys.workbook(wb?.id ?? ""), "history", wb?.updatedAt],
    enabled: !!wb,
    queryFn: async () => {
      const versions = await resources.versions(wb!.documentId);
      const links = await Promise.all(
        versions.map((v) =>
          resources.links(wb!.projectId, {
            type: "document_version",
            id: v.id,
          }),
        ),
      );
      const ids = [
        ...new Set(
          links
            .flat()
            .flatMap((l) => [l.from, l.to])
            .filter((e) => e.type === "workbook_version")
            .map((e) => e.id),
        ),
      ];
      return (
        await Promise.all(
          ids.map((id) =>
            client.fetchQuery({
              queryKey: queryKeys.workbookVersion(id),
              queryFn: () => resources.workbookVersion(id),
            }),
          ),
        )
      ).sort((a, b) => b.versionNumber - a.versionNumber);
    },
  });
}
