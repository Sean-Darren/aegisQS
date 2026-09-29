"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  SeverityBadge,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { formatDate, formatPercent, type FormatLocale } from "@/lib/format";
import {
  auditorKindSchema,
  flagStatusSchema,
  signalKeySchema,
  type Flag,
  type Severity,
} from "@/schemas";
import { useFlagDisposition, useProjectFlags } from "../api";
import {
  canBulkProposeDismiss,
  filterInboxFlags,
  flagInboxStats,
  initialInboxFilters,
  type InboxFilters,
} from "../model";

const selectClass =
  "mt-1 h-9 w-full rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600";
const severities: Severity[] = ["critical", "high", "medium", "low"];
const noFlags: Flag[] = [];

export function FlagsInbox({ projectId }: { projectId: string }) {
  const t = useTranslations("FlagsInbox");
  const common = useTranslations("Common");
  const statuses = useTranslations("Status.severity");
  const auditors = useTranslations("Auditors");
  const signals = useTranslations("ScoreDetail.signals");
  const locale = useLocale() as FormatLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const session = useSession();
  const flags = useProjectFlags(projectId);
  const tenderers = useQuery({
    queryKey: queryKeys.tenderers(projectId),
    queryFn: () => resources.tenderers(projectId),
  });
  const disposition = useFlagDisposition(projectId, session.data?.id ?? "");
  const [filters, setFilters] = useState<InboxFilters>(initialInboxFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState(false);
  const allFlags = flags.data ?? noFlags;
  const visible = useMemo(
    () => filterInboxFlags(allFlags, filters, session.data?.id ?? ""),
    [allFlags, filters, session.data?.id],
  );
  const stats = useMemo(() => flagInboxStats(allFlags), [allFlags]);
  const tendererNames = useMemo(
    () => new Map((tenderers.data ?? []).map((item) => [item.id, item.name])),
    [tenderers.data],
  );
  const assigneeIds = useMemo(
    () =>
      [
        ...new Set(allFlags.map((flag) => flag.assigneeId).filter(Boolean)),
      ] as string[],
    [allFlags],
  );
  const selectable = visible.filter(canBulkProposeDismiss);
  const selected = selectedIds.filter((id) =>
    selectable.some((flag) => flag.id === id),
  );

  function updateFilter<K extends keyof InboxFilters>(
    key: K,
    value: InboxFilters[K],
  ) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setSelectedIds([]);
  }
  function choosePreset(preset: InboxFilters["preset"]) {
    setFilters({ ...initialInboxFilters, preset });
    setSelectedIds([]);
  }
  function openEvidence(flagId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("evidence", flagId);
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  function toggleSelection(id: string) {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((current) => current !== id)
        : [...previous, id],
    );
  }
  async function bulkPropose() {
    if (
      !can(session.data, "flag.propose") ||
      selected.length === 0 ||
      bulkReason.trim().length < 10
    )
      return;
    setBulkPending(true);
    setBulkError(false);
    let succeeded = 0;
    for (const flagId of selected) {
      try {
        await disposition.mutateAsync({
          flagId,
          kind: "proposal",
          action: "dismiss",
          reason: bulkReason.trim(),
        });
        succeeded += 1;
      } catch {
        setBulkError(true);
      }
    }
    if (succeeded) toast(t("bulkSuccess", { count: succeeded }), "success");
    setSelectedIds([]);
    setBulkReason("");
    setBulkPending(false);
  }

  if (session.isPending || flags.isPending || tenderers.isPending)
    return (
      <section aria-label={common("loading")} className="space-y-4">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </section>
    );
  if (session.isError || flags.isError || tenderers.isError)
    return (
      <ErrorState
        message={t("loadError")}
        action={{
          label: common("retry"),
          onClick: () => {
            void session.refetch();
            void flags.refetch();
            void tenderers.refetch();
          },
        }}
      />
    );
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-ink">{t("description")}</p>
      </header>
      <section
        aria-label={t("summary")}
        className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {severities.map((severity) => (
          <div
            key={severity}
            className="rounded-lg border border-line bg-panel p-4"
          >
            <p className="text-xs text-muted-ink">{statuses(severity)}</p>
            <p className="num mt-1 text-right text-2xl font-semibold">
              {stats.severity[severity]}
            </p>
          </div>
        ))}
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="text-xs text-muted-ink">{t("blocking")}</p>
          <p className="num mt-1 text-right text-2xl font-semibold">
            {stats.blocking}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="text-xs text-muted-ink">{t("decided")}</p>
          <p className="num mt-1 text-right text-2xl font-semibold">
            {stats.decided}
          </p>
        </div>
      </section>
      <section
        aria-label={t("filters")}
        className="rounded-lg border border-line bg-panel p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "needsDecision", "criticalHigh"] as const).map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={filters.preset === preset ? "secondary" : "outline"}
              aria-pressed={filters.preset === preset}
              onClick={() => choosePreset(preset)}
            >
              {t(`presets.${preset}`)}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-[13px] font-medium">
            {t("severity")}
            <select
              className={selectClass}
              value={filters.severity}
              onChange={(event) =>
                updateFilter(
                  "severity",
                  event.target.value as InboxFilters["severity"],
                )
              }
            >
              <option value="all">{t("allSeverities")}</option>
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {statuses(severity)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            {t("status")}
            <select
              className={selectClass}
              value={filters.status}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value as InboxFilters["status"],
                )
              }
            >
              <option value="all">{t("allStatuses")}</option>
              {flagStatusSchema.options.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            {t("tenderer")}
            <select
              className={selectClass}
              value={filters.tendererId}
              onChange={(event) =>
                updateFilter("tendererId", event.target.value)
              }
            >
              <option value="">{t("allTenderers")}</option>
              {(tenderers.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            {t("auditor")}
            <select
              className={selectClass}
              value={filters.auditor}
              onChange={(event) =>
                updateFilter(
                  "auditor",
                  event.target.value as InboxFilters["auditor"],
                )
              }
            >
              <option value="all">{t("allAuditors")}</option>
              {auditorKindSchema.options.map((auditor) => (
                <option key={auditor} value={auditor}>
                  {auditors(auditor)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            {t("signal")}
            <select
              className={selectClass}
              value={filters.signal}
              onChange={(event) =>
                updateFilter(
                  "signal",
                  event.target.value as InboxFilters["signal"],
                )
              }
            >
              <option value="all">{t("allSignals")}</option>
              {signalKeySchema.options.map((signal) => (
                <option key={signal} value={signal}>
                  {signals(signal)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium">
            {t("assignee")}
            <select
              className={selectClass}
              value={filters.assignee}
              onChange={(event) => updateFilter("assignee", event.target.value)}
            >
              <option value="all">{t("allAssignees")}</option>
              <option value="mine">{t("assignedToMe")}</option>
              <option value="unassigned">{t("unassigned")}</option>
              {assigneeIds
                .filter((id) => id !== session.data?.id)
                .map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>
      {can(session.data, "flag.propose") && selectable.length > 0 && (
        <section
          aria-label={t("bulkTitle")}
          className="rounded-lg border border-line bg-panel p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl flex-1">
              <h2 className="text-sm font-semibold">{t("bulkTitle")}</h2>
              <p className="mt-1 text-xs text-muted-ink">
                {t("bulkDescription")}
              </p>
              <label className="mt-3 block text-[13px] font-medium">
                {t("reason")}
                <Textarea
                  className="mt-1 min-h-20"
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  aria-invalid={!!bulkReason && bulkReason.trim().length < 10}
                />
              </label>
              <p className="mt-1 text-xs text-muted-ink">{t("reasonHint")}</p>
            </div>
            <Button
              variant="secondary"
              disabled={
                !selected.length || bulkReason.trim().length < 10 || bulkPending
              }
              onClick={() => void bulkPropose()}
            >
              {t("bulkAction", { count: selected.length })}
            </Button>
          </div>
          {bulkError && (
            <p role="alert" className="mt-2 text-sm text-risk">
              {t("bulkError")}
            </p>
          )}
        </section>
      )}
      {allFlags.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : visible.length === 0 ? (
        <EmptyState message={t("noMatches")} />
      ) : (
        <section
          aria-label={t("tableTitle")}
          className="overflow-x-auto rounded-lg border border-line bg-panel"
        >
          <table className="num w-full min-w-[1120px] border-collapse text-sm">
            <thead className="bg-stone-50 text-[13px] text-muted-ink">
              <tr>
                <th
                  scope="col"
                  className="w-10 border-b border-line px-3 py-2 text-left"
                >
                  {can(session.data, "flag.propose") &&
                    selectable.length > 0 && (
                      <input
                        type="checkbox"
                        aria-label={t("selectAllLow")}
                        checked={selected.length === selectable.length}
                        onChange={(event) =>
                          setSelectedIds(
                            event.target.checked
                              ? selectable.map((flag) => flag.id)
                              : [],
                          )
                        }
                        className="size-4 accent-clay-700"
                      />
                    )}
                </th>
                {[
                  "flag",
                  "tenderer",
                  "severity",
                  "confidence",
                  "status",
                  "auditor",
                  "signal",
                  "assignee",
                  "created",
                ].map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className={`border-b border-line px-3 py-2 font-medium ${key === "confidence" ? "text-right" : "text-left"}`}
                  >
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((flag: Flag) => (
                <tr
                  key={flag.id}
                  data-flag-id={flag.id}
                  className={`border-b border-line last:border-0 hover:bg-stone-50 ${searchParams.get("evidence") === flag.id ? "border-l-2 border-l-clay-600 bg-limewash-100" : ""}`}
                >
                  <td className="h-9 px-3 py-1">
                    {can(session.data, "flag.propose") &&
                      canBulkProposeDismiss(flag) && (
                        <input
                          type="checkbox"
                          aria-label={t("selectFlag", { title: flag.title })}
                          checked={selected.includes(flag.id)}
                          onChange={() => toggleSelection(flag.id)}
                          className="size-4 accent-clay-700"
                        />
                      )}
                  </td>
                  <td className="max-w-72 px-3 py-1">
                    <button
                      type="button"
                      data-evidence-trigger={flag.id}
                      onClick={() => openEvidence(flag.id)}
                      className="block max-w-full truncate rounded-sm text-left font-semibold text-clay-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                      title={flag.title}
                    >
                      {flag.title}
                    </button>
                    <span className="text-xs text-muted-ink">
                      {flag.boqItemRef ?? flag.id}
                    </span>
                    {flag.evidence.length === 0 && (
                      <span
                        role="alert"
                        className="mt-1 flex items-center gap-1 text-xs text-risk"
                      >
                        <TriangleAlert size={14} aria-hidden="true" />
                        {t("missingEvidence")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1">
                    {flag.tendererId
                      ? (tendererNames.get(flag.tendererId) ?? flag.tendererId)
                      : t("projectWide")}
                  </td>
                  <td className="px-3 py-1">
                    <SeverityBadge severity={flag.severity} />
                  </td>
                  <td className="px-3 py-1 text-right">
                    {formatPercent(flag.confidence, locale)}
                  </td>
                  <td className="px-3 py-1">{t(`statuses.${flag.status}`)}</td>
                  <td className="px-3 py-1">{auditors(flag.auditor)}</td>
                  <td className="px-3 py-1">{signals(flag.signal)}</td>
                  <td className="px-3 py-1">
                    {flag.assigneeId === session.data?.id
                      ? t("me")
                      : (flag.assigneeId ?? t("unassigned"))}
                  </td>
                  <td className="px-3 py-1 text-right">
                    {formatDate(flag.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
