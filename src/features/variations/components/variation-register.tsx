"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { queryKeys, resources } from "@/lib/api";
import {
  Actor,
  SummaryCard,
  StatusChip,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
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
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: queryKeys.variations(projectId),
    queryFn: () => resources.variations(projectId),
  });
  const list = query.data ?? [];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("register")}</h1>
      {query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        !query.isError && (
          <div className="grid gap-4 md:grid-cols-2">
            {["potential", "confirmed"].map((s) => (
              <SummaryCard
                key={s}
                label={t(`totals.${s}`)}
                value={formatCurrency(
                  list
                    .filter((v) =>
                      s === "potential"
                        ? ["potential", "under_review"].includes(v.status)
                        : v.status === s,
                    )
                    .reduce(
                      (sum, v) => sum + (v.indicativeCost?.total ?? 0),
                      0,
                    ),
                )}
                context={formatRange(
                  ...((["low", "high"] as const).map((bound) =>
                    list
                      .filter((v) =>
                        s === "potential"
                          ? ["potential", "under_review"].includes(v.status)
                          : v.status === s,
                      )
                      .reduce(
                        (sum, v) => sum + (v.indicativeCost?.[bound] ?? 0),
                        0,
                      ),
                  ) as [number, number]),
                )}
              />
            ))}
          </div>
        )
      )}
      <label>
        {t("status")}
        <select
          className={inputStyle}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("all")}</option>
          {variationStatusSchema.options.map((v) => (
            <option key={v} value={v}>
              {t(`statuses.${v}`)}
            </option>
          ))}
        </select>
      </label>
      {query.isPending && <Skeleton className="h-64 w-full" />}
      {query.isError && <ErrorState message={t("error")} />}
      {query.data &&
        list.filter((v) => !status || v.status === status).length === 0 && (
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
          <tbody>
            {list
              .filter((v) => !status || v.status === status)
              .map((v) => (
                <tr key={v.id} className="border-t border-line">
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
                      t("unpriced")
                    )}
                  </td>
                  <td className="p-3">
                    <Actor value={v.raisedBy} /> ·{" "}
                    {formatDate(v.raisedAt, locale)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
