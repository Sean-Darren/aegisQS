"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
import type { DispositionInput, Flag } from "@/schemas";

export function useProjectFlags(projectId: string) {
  return useQuery({
    queryKey: queryKeys.flags(projectId),
    queryFn: () => resources.flags(projectId),
    enabled: !!projectId,
  });
}

type Disposition = DispositionInput & {
  flagId: string;
  kind: "proposal" | "decision";
};

export function optimisticFlag(
  flag: Flag,
  input: Disposition,
  userId: string,
): Flag {
  const decision = {
    action: input.action,
    reason: input.reason.trim(),
    by: userId,
    at: new Date().toISOString(),
  };
  if (input.kind === "proposal")
    return { ...flag, proposal: decision, status: "proposed" };
  const status = {
    accept: "accepted",
    dismiss: "dismissed",
    escalate: "escalated",
  } as const;
  return { ...flag, decision, status: status[input.action] };
}

export function useFlagDisposition(projectId: string, userId: string) {
  const client = useQueryClient();
  const listKey = queryKeys.flags(projectId);
  return useMutation({
    mutationFn: ({ flagId, kind, action, reason }: Disposition) =>
      kind === "proposal"
        ? resources.propose(flagId, { action, reason })
        : resources.decide(flagId, { action, reason }),
    onMutate: async (input) => {
      const flagKey = queryKeys.flag(input.flagId);
      await Promise.all([
        client.cancelQueries({ queryKey: listKey }),
        client.cancelQueries({ queryKey: flagKey }),
      ]);
      const previousList = client.getQueryData<Flag[]>(listKey);
      const previousFlag = client.getQueryData<Flag>(flagKey);
      client.setQueryData<Flag[]>(listKey, (current) =>
        current?.map((flag) =>
          flag.id === input.flagId ? optimisticFlag(flag, input, userId) : flag,
        ),
      );
      client.setQueryData<Flag>(flagKey, (current) =>
        current ? optimisticFlag(current, input, userId) : current,
      );
      return { previousList, previousFlag };
    },
    onError: (_error, input, context) => {
      if (context?.previousList !== undefined)
        client.setQueryData(listKey, context.previousList);
      if (context?.previousFlag !== undefined)
        client.setQueryData(queryKeys.flag(input.flagId), context.previousFlag);
    },
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.flag(updated.id), updated);
      client.setQueryData<Flag[]>(listKey, (current) =>
        current?.map((flag) => (flag.id === updated.id ? updated : flag)),
      );
      void client.invalidateQueries({
        queryKey: queryKeys.auditEvents(projectId),
      });
      void client.invalidateQueries({ queryKey: queryKeys.kpis(projectId) });
      void client.invalidateQueries({
        queryKey: ["projects", projectId, "tender-overview"],
      });
    },
  });
}
