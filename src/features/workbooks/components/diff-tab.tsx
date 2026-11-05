"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { resources, queryKeys } from "@/lib/api";
import {
  formatCurrency,
  formatSignedCurrency,
  formatNumber,
  formatUnitRate,
} from "@/lib/format";
import { VirtualTable } from "@/components/grid";
import {
  Button,
  SummaryCard,
  StatusChip,
  ErrorState,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import { Link } from "@/i18n/navigation";
import { rowsCsv } from "@/lib/export/csv";
import type { Workbook, WorkbookVersion } from "@/schemas";
import {
  allVersionItems,
  amountDelta,
  rowSection,
  rateUnit,
  linkedVariations,
  type DiffRow,
} from "../diff-model";
const TotalsChart = dynamic(
  () => import("./version-totals-chart").then((m) => m.VersionTotalsChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);
export function DiffTab({
  workbook,
  versions,
  onSelectVersion,
}: {
  workbook: Workbook;
  versions: WorkbookVersion[];
  onSelectVersion: (id: string) => void;
}) {
  const t = useTranslations("WorkbookDiff");
  const fields = useTranslations("Workbooks.fields");
  const ordered = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );
  const current =
    ordered.find((v) => v.id === workbook.currentVersionId) ?? ordered[0];
  const previous = ordered.find(
    (v) => v.versionNumber < (current?.versionNumber ?? 0),
  );
  const [base, setBase] = useState<string>();
  const [target, setTarget] = useState<string>();
  const [kind, setKind] = useState("");
  const [section, setSection] = useState("");
  const [increases, setIncreases] = useState(false);
  const baseId = base ?? previous?.id ?? "",
    targetId = target ?? current?.id ?? "";
  const valid = !!baseId && !!targetId && baseId !== targetId;
  const diff = useQuery({
    queryKey: queryKeys.diff(workbook.id, baseId, targetId),
    queryFn: () => resources.diff(workbook.id, baseId, targetId),
    enabled: valid,
  });
  const baseItems = useQuery({
    queryKey: queryKeys.items(baseId),
    queryFn: () =>
      allVersionItems((cursor) => resources.items(baseId, { cursor })),
    enabled: !!baseId,
  });
  const targetItems = useQuery({
    queryKey: queryKeys.items(targetId),
    queryFn: () =>
      allVersionItems((cursor) => resources.items(targetId, { cursor })),
    enabled: !!targetId,
  });
  const variations = useQuery({
    queryKey: queryKeys.variations(workbook.projectId),
    queryFn: () => resources.variations(workbook.projectId),
  });
  const rows = diff.data?.rows ?? [];
  const sectionFor = (row: DiffRow) =>
    rowSection(row, baseItems.data ?? [], targetItems.data ?? []);
  const visible = rows.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      (!section || sectionFor(r) === section) &&
      (!increases || amountDelta(r) > 0),
  );
  function display(
    value: string | number | null,
    field: string,
    row: DiffRow,
    side: "before" | "after" = "after",
  ) {
    if (value === null) return "—";
    if (typeof value !== "number") return value;
    if (field === "amount") return formatCurrency(value);
    if (field === "rate") {
      const item = (
        row.kind === "removed" ? baseItems.data : targetItems.data
      )?.find((i) => i.sheet === row.sheet && i.row === row.row);
      const unit = rateUnit(row, side, item?.unit);
      return unit ? formatUnitRate(value, unit) : t("unavailable");
    }
    return formatNumber(value);
  }
  function csv() {
    const text = rowsCsv(
      [
        "kind",
        "sheet",
        "row",
        "itemRef",
        "description",
        "section",
        "field",
        "before",
        "after",
        "amountDelta",
      ].map((k) => t(`csv.${k}`)),
      visible.flatMap((r) =>
        (r.fields.length
          ? r.fields
          : [{ field: "", before: null, after: null }]
        ).map((f) => [
          r.kind,
          r.sheet,
          String(r.row),
          r.itemRef,
          r.description,
          sectionFor(r),
          f.field,
          String(f.before ?? ""),
          String(f.after ?? ""),
          String(amountDelta(r)),
        ]),
      ),
    );
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workbook.id}-${baseId}-${targetId}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <div className="flex flex-wrap gap-4">
        {[
          ["base", baseId, setBase],
          ["target", targetId, setTarget],
        ].map(([label, value, setter]) => (
          <label key={label as string}>
            {t(label as string)}
            <select
              aria-label={t(label as string)}
              className={inputStyle}
              value={value as string}
              onChange={(e) => (setter as (id: string) => void)(e.target.value)}
            >
              <option value="">{t("chooseVersion")}</option>
              {ordered.map((v) => (
                <option key={v.id} value={v.id}>
                  {t("version", { number: v.versionNumber })}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {!valid && <EmptyState message={t("chooseTwo")} />}
      {valid && diff.isPending && <Skeleton className="h-64 w-full" />}
      {(diff.isError ||
        baseItems.isError ||
        targetItems.isError ||
        variations.isError) && <ErrorState message={t("error")} />}
      {valid && diff.data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {(["added", "removed", "changed"] as const).map((k) => (
              <SummaryCard
                key={k}
                label={t(`summary.${k}`)}
                value={formatNumber(diff.data.summary[k])}
              />
            ))}
            <SummaryCard
              label={t("totalChange")}
              value={
                <span
                  className={
                    diff.data.summary.totalDelta > 0 ? "text-risk" : "text-ink"
                  }
                >
                  {formatSignedCurrency(diff.data.summary.totalDelta)}
                </span>
              }
              context={t("basis")}
            />
          </div>
          <p className="text-sm text-muted-ink">{t("invalidAmounts")}</p>
          <div className="flex flex-wrap items-end gap-4">
            <label>
              {t("kind")}
              <select
                className={inputStyle}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">{t("all")}</option>
                {["added", "removed", "changed"].map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("section")}
              <select
                disabled={baseItems.isPending || targetItems.isPending}
                className={inputStyle}
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">{t("all")}</option>
                {[...new Set(rows.map(sectionFor).filter(Boolean))].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={increases}
                onChange={(e) => setIncreases(e.target.checked)}
              />{" "}
              {t("increases")}
            </label>
            <Button
              variant="outline"
              disabled={
                baseItems.isPending ||
                targetItems.isPending ||
                variations.isPending
              }
              onClick={csv}
            >
              {t("export")}
            </Button>
          </div>
          {baseItems.isPending ||
          targetItems.isPending ||
          variations.isPending ? (
            <Skeleton className="h-96 w-full" />
          ) : visible.length === 0 ? (
            <EmptyState message={t("empty")} />
          ) : (
            <div className="rounded-lg border border-line bg-panel">
              <VirtualTable
                label={t("table")}
                rows={visible}
                rowHeight={132}
                columns="120px 100px minmax(180px,1fr) minmax(320px,2fr) 170px 140px"
                header={[
                  "kind",
                  "item",
                  "description",
                  "fields",
                  "delta",
                  "variations",
                ].map((k) => (
                  <div role="columnheader" key={k} className="p-2 text-xs">
                    {t(k)}
                  </div>
                ))}
                renderRow={(row) => (
                  <>
                    <div role="cell" className="border-t border-line p-2">
                      <StatusChip
                        domain="workbookDiffKind"
                        value={row.kind}
                        compact
                      />
                      <p className="text-xs tabular-nums">
                        {row.sheet}!{row.row}
                      </p>
                    </div>
                    <div role="cell" className="border-t border-line p-2">
                      {row.itemRef}
                    </div>
                    <div
                      role="cell"
                      className="border-t border-line p-2 text-sm"
                    >
                      {row.description}
                      <p className="text-xs text-muted-ink">
                        {sectionFor(row)}
                      </p>
                    </div>
                    <div
                      role="cell"
                      className="overflow-auto border-t border-line p-2 text-sm tabular-nums"
                    >
                      {row.fields.length === 0 && <p>{t("referenceChange")}</p>}
                      {row.fields.map((f) => (
                        <p key={f.field}>
                          <span>{fields(f.field)}</span>:{" "}
                          <del className="text-muted-ink">
                            {display(f.before, f.field, row, "before")}
                          </del>{" "}
                          → {display(f.after, f.field, row)}
                        </p>
                      ))}
                    </div>
                    <div
                      role="cell"
                      className={`border-t border-line p-2 text-right tabular-nums ${amountDelta(row) > 0 ? "text-risk" : "text-ink"}`}
                    >
                      {formatSignedCurrency(amountDelta(row))}
                    </div>
                    <div role="cell" className="border-t border-line p-2">
                      {linkedVariations(row, variations.data ?? []).map((v) => (
                        <Link
                          key={v.id}
                          className="inline-block rounded-sm border border-line px-2 py-1 text-clay-700 underline"
                          href={`/projects/${workbook.projectId}/variations/${v.id}`}
                        >
                          {v.ref}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              />
            </div>
          )}
        </>
      )}
      <section className="space-y-2 rounded-lg border border-line bg-panel p-4">
        <h3 className="font-semibold">{t("totals")}</h3>
        {versions.length > 0 && (
          <TotalsChart
            versions={versions}
            onSelect={(id) => {
              setTarget(id);
              onSelectVersion(id);
            }}
          />
        )}
        <table className="w-full text-sm tabular-nums">
          <caption className="text-left text-muted-ink">
            {t("chartAlternative")}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-left">
                {t("versionHeading")}
              </th>
              <th scope="col" className="text-right">
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...ordered].reverse().map((v) => (
              <tr key={v.id} className="border-t border-line">
                <th scope="row" className="text-left">
                  <button
                    className="p-2 text-clay-700 underline"
                    onClick={() => {
                      setTarget(v.id);
                      onSelectVersion(v.id);
                    }}
                  >
                    {t("version", { number: v.versionNumber })}
                  </button>
                </th>
                <td className="p-2 text-right">
                  {v.totals
                    ? formatCurrency(v.totals.reduce((s, a) => s + a.amount, 0))
                    : t("unavailable")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
