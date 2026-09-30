"use client";
import { useTranslations } from "next-intl";
import { RiskBandBadge } from "@/components/ui/status-badges";
import { formatCompactCurrency, formatNumber } from "@/lib/format";
import type { Bid, ComplianceScore, Tenderer } from "@/schemas";

export function ReportScoreTable({
  scores,
  tenderers,
  bids,
}: {
  scores: ComplianceScore[];
  tenderers: Tenderer[];
  bids: Bid[];
}) {
  const t = useTranslations("Reports");
  const names = new Map(
    tenderers.map((tenderer) => [tenderer.id, tenderer.name]),
  );
  const values = new Map(bids.map((bid) => [bid.id, bid.totalValueHKD]));
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="num w-full min-w-[540px] text-sm">
        <caption className="border-b border-line px-5 py-4 text-left text-lg font-semibold text-ink">
          {t("scoreSummary")}
        </caption>
        <thead className="bg-stone-50 text-muted-ink">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              {t("tenderer")}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t("bidValue")}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t("score")}
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              {t("riskBand")}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...scores]
            .sort((a, b) => b.score - a.score)
            .map((score) => (
              <tr key={score.bidId} className="border-t border-line">
                <th
                  scope="row"
                  className="px-4 py-3 text-left font-medium text-ink"
                >
                  {names.get(score.tendererId) ?? score.tendererId}
                </th>
                <td className="px-4 py-3 text-right text-ink">
                  {values.has(score.bidId)
                    ? formatCompactCurrency(values.get(score.bidId)!)
                    : t("noBidValue")}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-ink">
                  {formatNumber(score.score)} / 100
                </td>
                <td className="px-4 py-3">
                  <RiskBandBadge band={score.band} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
