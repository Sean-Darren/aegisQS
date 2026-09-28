"use client";
import { useQuery } from "@tanstack/react-query";
import { resources } from "@/lib/api";

export function useTenderOverviewData(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["projects", projectId, "tender-overview"],
    enabled,
    queryFn: async () => {
      const [
        kpis,
        tenderers,
        bids,
        scores,
        distribution,
        flags,
        documents,
        auditPage,
      ] = await Promise.all([
        resources.kpis(projectId),
        resources.tenderers(projectId),
        resources.bids(projectId),
        resources.scores(projectId),
        resources.priceDistribution(projectId),
        resources.flags(projectId),
        resources.documents(projectId),
        resources.auditEvents(projectId),
      ]);
      return {
        kpis,
        tenderers,
        bids,
        scores,
        distribution,
        flags,
        documents,
        auditEvents: auditPage.data,
      };
    },
  });
}
