"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { queryKeys, resources } from "@/lib/api";
import type { EntityLink } from "@/schemas";
import { ErrorState, Skeleton } from "@/components/ui";
export function recordHref(projectId: string, type: string, id: string) {
  const root = `/projects/${projectId}`;
  switch (type) {
    case "document":
      return `${root}/documents/${id}`;
    case "variation":
      return `${root}/variations/${id}`;
    case "comparison":
      return `${root}/drawings/compare/${id}`;
    case "material":
      return `/materials?detail=material:${encodeURIComponent(id)}`;
    case "workbook":
      return `${root}/workbooks?detail=workbook:${encodeURIComponent(id)}`;
    default:
      return `${root}/documents?detail=${type}:${encodeURIComponent(id)}`;
  }
}
export function LinkedRecords({
  projectId,
  type,
  id,
  comparisonId,
}: {
  projectId: string;
  type: EntityLink["from"]["type"];
  id: string;
  comparisonId?: string;
}) {
  const t = useTranslations("Records");
  const query = useQuery({
    queryKey: queryKeys.links(projectId, { type, id }),
    queryFn: () => resources.links(projectId, { type, id }),
  });
  const records = (query.data ?? [])
    .map((l) => (l.from.type === type && l.from.id === id ? l.to : l.from))
    .filter(
      (e, i, a) => a.findIndex((x) => x.type === e.type && x.id === e.id) === i,
    );
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t("linked")}</h2>
      {query.isPending && <Skeleton className="h-16 w-full" />}
      {query.isError && <ErrorState message={t("error")} />}
      {query.data && records.length === 0 && (
        <p className="text-sm text-muted-ink">{t("none")}</p>
      )}
      <ul className="flex flex-wrap gap-2">
        {records.map((e) => (
          <li key={`${e.type}:${e.id}`}>
            <Link
              className="inline-block rounded-md border border-line px-3 py-2 text-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-clay-600"
              href={
                e.type === "change" && comparisonId
                  ? `${recordHref(projectId, "comparison", comparisonId)}?change=${encodeURIComponent(e.id)}`
                  : recordHref(projectId, e.type, e.id)
              }
            >
              {t(`types.${e.type}`)} · {e.id}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
