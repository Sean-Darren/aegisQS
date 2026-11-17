"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { queryKeys, resources } from "@/lib/api";
import {
  Actor,
  SummaryCard,
  StatusChip,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components/ui";
import {
  formatCurrency,
  formatRange,
  formatDate,
  type FormatLocale,
} from "@/lib/format";
import { variationStatusSchema } from "@/schemas";

export function VariationRegister({ projectId }: { projectId: string }) {
  const t = useTranslations("Variation");
  const locale = useLocale() as FormatLocale;
  const router = useRouter();
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: queryKeys.variations(projectId),
    queryFn: () => resources.variations(projectId),
  });
  const list = query.data ?? [];
  const totals = (["potential", "confirmed"] as const).map((s) => {
    const statuses = s === "potential" ? ["potential", "under_review"] : [s];
    const items = list.filter((v) => statuses.includes(v.status));
    const priced = items.filter((v) => v.indicativeCost);
    return {
      key: s,
      count: items.length,
      priced: priced.length > 0,
      total: priced.reduce((sum, v) => sum + (v.indicativeCost?.total ?? 0), 0),
      range: (["low", "high"] as const).map((bound) =>
        priced.reduce((sum, v) => sum + (v.indicativeCost?.[bound] ?? 0), 0),
      ) as [number, number],
    };
  });
  const visible = list
    .filter((v) => !status || v.status === status)
    .toSorted((a, b) => b.raisedAt.localeCompare(a.raisedAt));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("register")}</h1>
      {query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        !query.isError && (
          <div className="grid gap-4 md:grid-cols-2">
            {totals.map((total) => (
              <SummaryCard
                key={total.key}
                label={`${t(`totals.${total.key}`)} (${total.count})`}
                value={
                  total.priced ? formatCurrency(total.total) : t("noPrices")
                }
                context={
                  total.priced
                    ? formatRange(total.range[0], total.range[1])
                    : t("unpricedHint")
                }
              />
            ))}
          </div>
        )
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t("status")}
          <select
            className="h-9 w-48 rounded-md border border-line-strong bg-panel px-3 text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">
              {t("all")} ({list.length})
            </option>
            {variationStatusSchema.options.map((v) => (
              <option key={v} value={v}>
                {t(`statuses.${v}`)} (
                {list.filter((item) => item.status === v).length})
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending && <Skeleton className="h-64 w-full" />}
      {query.isError && <ErrorState message={t("error")} />}
      {query.data && visible.length === 0 && (
        <EmptyState message={t("empty")} />
      )}
      <div className="overflow-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="bg-stone-50">
            <tr>
              {["ref", "title", "drawing", "status", "cost", "raised"].map(
                (k) => (
                  <th scope="col" className="p-3" key={k}>
                    {t(k)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((v) => (
              <tr
                key={v.id}
                onClick={() =>
                  router.push(`/projects/${projectId}/variations/${v.id}`)
                }
                className="group cursor-pointer transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay-600"
              >
                <th scope="row" className="p-3 font-medium">
                  <Link
                    className="text-clay-700 underline"
                    href={`/projects/${projectId}/variations/${v.id}`}
                  >
                    {v.ref}
                  </Link>
                </th>
                <td className="p-3">{v.title}</td>
                <td className="p-3">{v.drawingNumber}</td>
                <td className="p-3">
                  <StatusChip domain="variationStatus" value={v.status} />
                </td>
                <td className="p-3 text-right">
                  {v.indicativeCost ? (
                    <>
                      {formatCurrency(v.indicativeCost.total)}
                      <p className="text-xs text-muted-ink">
                        {formatRange(
                          v.indicativeCost.low,
                          v.indicativeCost.high,
                        )}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted-ink">{t("unpriced")}</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <Actor value={v.raisedBy} /> ·{" "}
                      {formatDate(v.raisedAt, locale)}
                    </span>
                    <ChevronRight
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="shrink-0 text-muted-ink opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
