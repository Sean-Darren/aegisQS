"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileSearch } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { thresholds } from "@/lib/config";
import { formatCompactCurrency, formatPercent } from "@/lib/format";
import { EvidenceViewer } from "@/features/evidence";
import {
  exceedsProvisionalSumThreshold,
  hasInspectionReport,
  provisionalSumFlagsByTenderer,
  provisionalSumShare,
  scopeCounts,
  scopeStatuses,
  type ScopeStatus,
} from "../model";
import { ScopeStatusBadge } from "./scope-status-badge";

const ProvisionalSumPlot = dynamic(() => import("./provisional-sum-plot"), {
  ssr: false,
  loading: () => <Skeleton className="h-[430px] w-full" />,
});
type Filter = ScopeStatus | "all";

export function ScopeWorkspace({ projectId }: { projectId: string }) {
  const t = useTranslations("ScopeGaps");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useSession();
  const gaps = useQuery({
    queryKey: queryKeys.scopeGaps(projectId),
    queryFn: () => resources.scopeGaps(projectId),
  });
  const documents = useQuery({
    queryKey: queryKeys.documents(projectId),
    queryFn: () => resources.documents(projectId),
  });
  const bids = useQuery({
    queryKey: queryKeys.bids(projectId),
    queryFn: () => resources.bids(projectId),
  });
  const tenderers = useQuery({
    queryKey: queryKeys.tenderers(projectId),
    queryFn: () => resources.tenderers(projectId),
  });
  const provisionalFlags = useQuery({
    queryKey: queryKeys.flagList(projectId, {
      signal: "provisional_sum_concentration",
    }),
    queryFn: () =>
      resources.flags(projectId, { signal: "provisional_sum_concentration" }),
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      (gaps.data ?? []).filter(
        (gap) => filter === "all" || gap.status === filter,
      ),
    [filter, gaps.data],
  );
  const counts = useMemo(() => scopeCounts(gaps.data ?? []), [gaps.data]);
  const flagIdsByTenderer = useMemo(
    () => provisionalSumFlagsByTenderer(provisionalFlags.data ?? []),
    [provisionalFlags.data],
  );
  const selected = visible.find((gap) => gap.id === selectedId) ?? visible[0];
  const inspectionDocuments =
    documents.data?.filter((doc) => doc.type === "inspection_report") ?? [];
  const inspectionIds = new Set(inspectionDocuments.map((doc) => doc.id));
  const sourceDocument = selected
    ? documents.data?.find((doc) => doc.id === selected.finding.documentId)
    : undefined;

  function openFlag(flagId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("evidence", flagId);
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  if (
    session.isPending ||
    gaps.isPending ||
    documents.isPending ||
    bids.isPending ||
    tenderers.isPending ||
    provisionalFlags.isPending
  ) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (
    session.isError ||
    gaps.isError ||
    documents.isError ||
    bids.isError ||
    tenderers.isError ||
    provisionalFlags.isError
  ) {
    return (
      <ErrorState
        message={t("loadError")}
        action={{
          label: t("retry"),
          onClick: () => {
            void Promise.all([
              session.refetch(),
              gaps.refetch(),
              documents.refetch(),
              bids.refetch(),
              tenderers.refetch(),
              provisionalFlags.refetch(),
            ]);
          },
        }}
      />
    );
  }
  if (!can(session.data, "project.view"))
    return <ErrorState message={t("accessDenied")} />;
  if (!hasInspectionReport(documents.data))
    return (
      <EmptyState
        message={t("noInspectionReport")}
        action={{
          label: t("openDocuments"),
          onClick: () =>
            router.push(`/${locale}/projects/${projectId}/documents`),
        }}
      />
    );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-ink">{t("description")}</p>
      </header>
      <section
        aria-labelledby="scope-register-heading"
        className="rounded-lg border border-line bg-panel shadow-sm"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2
              id="scope-register-heading"
              className="text-lg font-semibold text-ink"
            >
              {t("register")}
            </h2>
            <p className="text-sm text-muted-ink">{t("registerHelp")}</p>
          </div>
          <label className="text-xs font-medium text-muted-ink">
            {t("filterStatus")}
            <select
              className="mt-1 block h-9 min-w-40 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="all">{t("allStatuses")}</option>
              {scopeStatuses.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {scopeStatuses.map((status) => (
            <div
              key={status}
              className="flex items-center justify-between gap-2 bg-panel px-5 py-3"
            >
              <ScopeStatusBadge status={status} />
              <strong className="num text-right text-lg text-ink">
                {counts[status]}
              </strong>
            </div>
          ))}
        </div>
        {gaps.data.length === 0 ? (
          <div className="p-5">
            <EmptyState message={t("noFindings")} />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-5">
            <EmptyState message={t("noFilterResults")} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="num w-full min-w-[930px] text-sm">
              <thead className="bg-stone-50 text-muted-ink">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    {t("findingRef")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    {t("findingText")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t("sourcePage")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    {t("mappedBoqItem")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    {t("statusLabel")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    {t("linkedFlag")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((gap) => (
                  <tr
                    key={gap.id}
                    className={`border-t border-line ${selected?.id === gap.id ? "bg-limewash-100" : "hover:bg-stone-50"}`}
                  >
                    <td className="px-4 py-3 font-semibold">
                      <button
                        className="rounded-sm text-left text-clay-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                        onClick={() => setSelectedId(gap.id)}
                        aria-current={
                          selected?.id === gap.id ? "true" : undefined
                        }
                      >
                        {gap.finding.ref}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink">{gap.finding.text}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex items-center gap-1 rounded-sm text-clay-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                        onClick={() => setSelectedId(gap.id)}
                        aria-label={t("viewSourcePage", {
                          page: gap.finding.page,
                          ref: gap.finding.ref,
                        })}
                      >
                        {gap.finding.page}
                        <FileSearch size={14} aria-hidden="true" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {gap.mappedBoqItemRef ?? t("notMapped")}
                    </td>
                    <td className="px-4 py-3">
                      <ScopeStatusBadge status={gap.status} />
                    </td>
                    <td className="px-4 py-3">
                      {gap.flagId ? (
                        <button
                          className="inline-flex items-center gap-1 rounded-sm text-clay-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                          onClick={() => openFlag(gap.flagId!)}
                        >
                          {t("openFlag", { id: gap.flagId })}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-muted-ink">
                          {t("noLinkedFlag")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <section
          aria-labelledby="source-heading"
          className="rounded-lg border border-line bg-panel p-5 shadow-sm"
        >
          <div className="mb-4">
            <h2 id="source-heading" className="text-lg font-semibold text-ink">
              {t("sourceEvidence")}
            </h2>
            <p className="text-sm text-muted-ink">
              {sourceDocument?.fileName ?? t("sourceDocument")} ·{" "}
              {t("page", { page: selected.finding.page })}
            </p>
          </div>
          {!inspectionIds.has(selected.finding.documentId) ? (
            <ErrorState message={t("sourceUnavailable")} />
          ) : (
            <>
              <p className="mb-4 rounded-md border-l-2 border-clay-600 bg-limewash-100 px-4 py-3 text-sm text-ink">
                <span className="font-semibold">{selected.finding.ref}</span> —{" "}
                <mark className="scope-finding-highlight">
                  {selected.finding.text}
                </mark>
              </p>
              <EvidenceViewer
                key={selected.id}
                evidence={{
                  id: selected.id,
                  documentId: selected.finding.documentId,
                  page: selected.finding.page,
                  excerpt: selected.finding.text,
                }}
                highlightText={selected.finding.text}
              />
            </>
          )}
        </section>
      )}
      <section
        aria-labelledby="provisional-heading"
        className="rounded-lg border border-line bg-panel p-5 shadow-sm"
      >
        <div className="mb-4">
          <h2
            id="provisional-heading"
            className="text-lg font-semibold text-ink"
          >
            {t("provisionalTitle")}
          </h2>
          <p className="text-sm text-muted-ink">
            {t("thresholdExplanation", {
              percent: thresholds.provisionalSumPercent,
            })}
          </p>
        </div>
        {bids.data.length === 0 ? (
          <EmptyState message={t("noBids")} />
        ) : (
          <>
            <div className="h-[430px]">
              <ProvisionalSumPlot
                bids={bids.data}
                tenderers={tenderers.data}
                flagIdsByTenderer={flagIdsByTenderer}
                onFlagClick={openFlag}
              />
            </div>
            <table className="sr-only">
              <caption>
                {t("chartTableCaption", {
                  percent: thresholds.provisionalSumPercent,
                })}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t("tenderer")}</th>
                  <th scope="col">{t("measuredWork")}</th>
                  <th scope="col">{t("provisionalSums")}</th>
                  <th scope="col">{t("share")}</th>
                  <th scope="col">{t("thresholdStatus")}</th>
                  <th scope="col">{t("linkedFlag")}</th>
                </tr>
              </thead>
              <tbody>
                {bids.data.map((bid) => (
                  <tr key={bid.id}>
                    <td>
                      {tenderers.data.find((item) => item.id === bid.tendererId)
                        ?.name ?? bid.tendererId}
                    </td>
                    <td>
                      {provisionalSumShare(bid) === null
                        ? t("insufficientBidData")
                        : formatCompactCurrency(
                            bid.totalValueHKD - bid.provisionalSumHKD,
                          )}
                    </td>
                    <td>
                      {provisionalSumShare(bid) === null
                        ? t("insufficientBidData")
                        : formatCompactCurrency(bid.provisionalSumHKD)}
                    </td>
                    <td>
                      {provisionalSumShare(bid) === null
                        ? t("insufficientBidData")
                        : formatPercent(provisionalSumShare(bid)!)}
                    </td>
                    <td>
                      {exceedsProvisionalSumThreshold(bid)
                        ? t("aboveThreshold")
                        : t("withinThreshold")}
                    </td>
                    <td>
                      {flagIdsByTenderer[bid.tendererId] ? (
                        <button
                          onClick={() =>
                            openFlag(flagIdsByTenderer[bid.tendererId])
                          }
                        >
                          {t("openFlag", {
                            id: flagIdsByTenderer[bid.tendererId],
                          })}
                        </button>
                      ) : (
                        t("noLinkedFlag")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
