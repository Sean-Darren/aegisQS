"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys, resources } from "@/lib/api";
import { AuditTimeline } from "@/features/audit";
import { ErrorState, Skeleton } from "@/components/ui";
import type { AuditEvent } from "@/schemas";
import { useRouter } from "@/i18n/navigation";
import { recordHref } from "./linked-records";
export function EntityActivity({
  projectId,
  entities,
}: {
  projectId: string;
  entities: { type: AuditEvent["entityType"]; id: string }[];
}) {
  const t = useTranslations("Records");
  const router = useRouter();
  const common = useTranslations("Common");
  const query = useQuery({
    queryKey: [...queryKeys.auditEvents(projectId), "entities", entities],
    queryFn: async () => {
      // One bounded single-shot request per entity (server-side filter)
      // instead of walking the audit log page by page for each entity.
      const lists = await Promise.all(
        entities.map((e) =>
          resources
            .auditEvents(projectId, undefined, {
              entityType: e.type,
              entityId: e.id,
              limit: 200,
            })
            .then((page) => page.data),
        ),
      );
      return lists.flat().sort((a, b) => b.at.localeCompare(a.at));
    },
  });
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("activity")}</h2>
      {query.isPending && <Skeleton className="h-20 w-full" />}
      {query.isError && (
        <ErrorState
          message={t("error")}
          action={{
            label: common("retry"),
            onClick: () => {
              void query.refetch();
            },
          }}
        />
      )}
      {query.data?.length === 0 && <p>{t("none")}</p>}
      {query.data && (
        <AuditTimeline
          projectId={projectId}
          events={query.data}
          onOpenDetail={(detail) => {
            const [type, ...parts] = detail.split(":");
            router.push(recordHref(projectId, type, parts.join(":")));
          }}
        />
      )}
    </section>
  );
}
