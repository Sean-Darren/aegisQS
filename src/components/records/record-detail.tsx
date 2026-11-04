"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resources, queryKeys } from "@/lib/api";
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusChip,
  AiGeneratedLabel,
  LowConfidenceNote,
} from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatFileSize,
  formatPeriod,
  formatRange,
  formatUnitRate,
  type FormatLocale,
} from "@/lib/format";
import { LinkedRecords, recordHref } from "./linked-records";
import type { BoqItem, WorkbookVersion } from "@/schemas";
import { useState } from "react";

function VersionRecord({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("Records");
  const locale = useLocale() as FormatLocale;
  const [error, setError] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.workbookVersion(id),
    queryFn: () => resources.workbookVersion(id),
  });
  async function download(version: WorkbookVersion) {
    setError(false);
    try {
      const url = URL.createObjectURL(
        await resources.downloadWorkbook(version.id),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = version.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    }
  }
  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState message={t("error")} />;
  const v = query.data;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{v.fileName}</h2>
      <p>{t(`workbookStates.${v.status}`)}</p>
      <p className="tabular-nums">
        {t("versionNumber", { number: v.versionNumber })} ·{" "}
        {formatFileSize(v.sizeBytes)} · {formatDate(v.uploadedAt, locale)} ·{" "}
        {v.uploadedBy}
      </p>
      <p>{v.sheetNames.join(", ")}</p>
      <Button variant="outline" onClick={() => void download(v)}>
        {t("downloadWorkbook")}
      </Button>
      {error && <ErrorState message={t("error")} />}
      <LinkedRecords projectId={projectId} type="workbook_version" id={id} />
    </div>
  );
}
function ItemRecord({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("Records");
  const query = useQuery({
    queryKey: ["linked-boq-item", projectId, id],
    queryFn: async () => {
      const links = await resources.links(projectId, { type: "boq_item", id });
      const versionId = links
        .flatMap((l) => [l.from, l.to])
        .find((e) => e.type === "workbook_version")?.id;
      if (!versionId)
        return (
          (await resources.boqItems(projectId)).find(
            (i) => i.id === id || i.itemRef === id,
          ) ?? null
        );
      let cursor: string | undefined;
      do {
        const page = await resources.items(versionId, { cursor });
        const item = page.data.find((i: BoqItem) => i.id === id);
        if (item) return item;
        cursor = page.nextCursor;
      } while (cursor);
      return null;
    },
  });
  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState message={t("error")} />;
  const item = query.data;
  if (!item) return <EmptyState message={t("notFound")} />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {item.itemRef} · {item.description}
      </h2>
      <p className="tabular-nums">
        {item.sheet} · {t("row", { number: item.row })}
      </p>
      <dl className="grid grid-cols-2 gap-2 tabular-nums">
        <dt>{t("quantity")}</dt>
        <dd className="text-right">
          {item.quantity ?? "—"} {item.unit}
        </dd>
        <dt>{t("rate")}</dt>
        <dd className="text-right">
          {item.rate === null ? "—" : formatUnitRate(item.rate, item.unit)}
        </dd>
        <dt>{t("amount")}</dt>
        <dd className="text-right">
          {item.amount === null ? "—" : formatCurrency(item.amount)}
        </dd>
      </dl>
      <LinkedRecords projectId={projectId} type="boq_item" id={item.id} />
    </div>
  );
}
function MaterialRecord({ id }: { id: string }) {
  const t = useTranslations("Records");
  const locale = useLocale() as FormatLocale;
  const materials = useQuery({
    queryKey: queryKeys.materials(),
    queryFn: () => resources.materials(),
  });
  const query = useQuery({
    queryKey: queryKeys.forecast(id),
    queryFn: () => resources.forecast(id),
  });
  if (query.isPending || materials.isPending)
    return <Skeleton className="h-64 w-full" />;
  if (query.isError || materials.isError)
    return <ErrorState message={t("error")} />;
  const material = materials.data.find((m) => m.id === id),
    forecast = query.data;
  if (!material) return <EmptyState message={t("notFound")} />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{material.name}</h2>
      <p className="tabular-nums">
        {formatUnitRate(material.latestPrice, material.unit)} ·{" "}
        {formatPeriod(material.latestPeriod, locale)}
      </p>
      <p className="text-sm">{material.source}</p>
      <h3 className="font-semibold">{t("forecast")}</h3>
      <p className="text-sm tabular-nums">
        {forecast.model.name} · {forecast.model.version} ·{" "}
        {t("trainedThrough", {
          period: formatPeriod(forecast.model.trainedThrough, locale),
        })}{" "}
        · {t("backtest", { error: forecast.model.backtestMapePct })}
      </p>
      <table className="w-full text-sm tabular-nums">
        <caption className="text-left text-muted-ink">
          {t("forecastUnit", { unit: material.unit })}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left">
              {t("period")}
            </th>
            <th scope="col" className="p-2 text-right">
              {t("median")}
            </th>
            <th scope="col" className="p-2 text-right">
              {t("likelyRange")}
            </th>
          </tr>
        </thead>
        <tbody>
          {forecast.forecast.map((p) => (
            <tr key={p.period} className="border-t border-line">
              <th scope="row" className="p-2 text-left font-normal">
                {formatPeriod(p.period, locale)}
              </th>
              <td className="p-2 text-right">{formatCurrency(p.p50)}</td>
              <td className="p-2 text-right">{formatRange(p.p10, p.p90)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function WorkbookRecord({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("Records");
  const query = useQuery({
    queryKey: queryKeys.workbook(id),
    queryFn: () => resources.workbook(id),
  });
  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState message={t("error")} />;
  return query.data.currentVersionId ? (
    <VersionRecord id={query.data.currentVersionId} projectId={projectId} />
  ) : (
    <EmptyState message={t("notFound")} />
  );
}
function ChangeRecord({ id, projectId }: { id: string; projectId: string }) {
  const t = useTranslations("Records");
  const query = useQuery({
    queryKey: ["linked-change", projectId, id],
    queryFn: async () => {
      const [drawings, variations] = await Promise.all([
        resources.drawings(projectId),
        resources.variations(projectId),
      ]);
      const comparisons = [
        ...new Set([
          ...drawings.flatMap((d) =>
            d.latestComparison ? [d.latestComparison.id] : [],
          ),
          ...variations.map((v) => v.comparisonId),
        ]),
      ];
      const lists = await Promise.all(
        comparisons.map((c) => resources.changes(c)),
      );
      return lists.flat().find((c) => c.id === id) ?? null;
    },
  });
  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState message={t("error")} />;
  const change = query.data;
  if (!change) return <EmptyState message={t("notFound")} />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        △{change.number} · {change.summary}
      </h2>
      <AiGeneratedLabel />
      <StatusChip domain="changeStatus" value={change.status} />
      <LowConfidenceNote confidence={change.confidence} />
      <Link
        className="block text-clay-700 underline"
        href={`${recordHref(projectId, "comparison", change.comparisonId)}?change=${encodeURIComponent(id)}`}
      >
        {t("openComparison")}
      </Link>
      <LinkedRecords projectId={projectId} type="change" id={id} />
    </div>
  );
}
export function RecordDetail({
  type,
  id,
  projectId,
}: {
  type: string;
  id: string;
  projectId: string;
}) {
  const t = useTranslations("Records");
  if (type === "change") return <ChangeRecord id={id} projectId={projectId} />;
  if (type === "boq_item") return <ItemRecord id={id} projectId={projectId} />;
  if (type === "workbook_version")
    return <VersionRecord id={id} projectId={projectId} />;
  if (type === "workbook")
    return <WorkbookRecord id={id} projectId={projectId} />;
  if (type === "material") return <MaterialRecord id={id} />;
  return <EmptyState message={t("notFound")} />;
}
