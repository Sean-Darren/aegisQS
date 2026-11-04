"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EmptyState, ErrorState, Skeleton, StatusChip } from "@/components/ui";
import { useDocuments } from "../api";
export function DocumentsPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Documents");
  const common = useTranslations("Common");
  const query = useDocuments(projectId);
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {query.isPending && <Skeleton className="h-64 w-full" />}
      {query.isError && (
        <ErrorState
          message={t("error")}
          action={{
            label: common("retry"),
            onClick: () => void query.refetch(),
          }}
        />
      )}
      {query.data?.length === 0 && <EmptyState message={t("empty")} />}
      {!!query.data?.length && (
        <div className="overflow-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="bg-stone-50 text-muted-ink">
              <tr>
                {["number", "title", "category", "versions", "status"].map(
                  (key) => (
                    <th
                      key={key}
                      scope="col"
                      className={`px-4 py-3 font-medium ${key === "versions" ? "text-right" : ""}`}
                    >
                      {t(key)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {query.data.map((doc) => (
                <tr key={doc.id} className="border-t border-line">
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link
                      href={`/projects/${projectId}/documents?detail=document:${encodeURIComponent(doc.id)}`}
                      className="rounded-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                    >
                      {doc.docNumber}
                    </Link>
                  </th>
                  <td className="px-4 py-3">{doc.title}</td>
                  <td className="px-4 py-3">
                    {t(`categories.${doc.category}`)}
                  </td>
                  <td className="px-4 py-3 text-right">{doc.versionCount}</td>
                  <td className="px-4 py-3">
                    <StatusChip
                      domain="versionStatus"
                      value={doc.hasConflict ? "conflict" : "current"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
