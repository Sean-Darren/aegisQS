"use client";
import dynamic from "next/dynamic";
import { ArrowUpRight, CircleDashed, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, RiskBandBadge, SeverityBadge } from "@/components/ui";
import { riskBandFor } from "@/lib/config";
import { formatDate, formatPercent, type FormatLocale } from "@/lib/format";
import type { Flag, SignalKey } from "@/schemas";
import { sortedSignalKeys, type RankedTenderer } from "../model";

const ScoreSignalPlot = dynamic(() => import("./score-signal-plot"), {
  ssr: false,
});

export function ScoreDetailPanel({
  primary,
  comparison,
  tenderers,
  flags,
  onCompare,
  onClose,
  onEvidence,
}: {
  primary: RankedTenderer;
  comparison?: RankedTenderer;
  tenderers: RankedTenderer[];
  flags: Flag[];
  onCompare: (id: string | null) => void;
  onClose: () => void;
  onEvidence: (flagId: string) => void;
}) {
  const t = useTranslations("ScoreDetail");
  const locale = useLocale() as FormatLocale;
  const items = comparison ? [primary, comparison] : [primary];
  const signalKeys = sortedSignalKeys(items.map((item) => item.score));
  const labels = Object.fromEntries(
    signalKeys.map((key) => [key, t(`signals.${key}`)]),
  ) as Record<SignalKey, string>;
  const number = new Intl.NumberFormat(locale === "en" ? "en-HK" : locale, {
    maximumFractionDigits: 3,
  });
  return (
    <section
      id="score-detail"
      aria-labelledby="score-detail-heading"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 id="score-detail-heading" className="text-lg font-semibold">
            {t("title", { name: primary.tenderer.name })}
          </h2>
          <p className="mt-1 text-sm text-muted-ink">{t("description")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} aria-hidden="true" />
          {t("close")}
        </Button>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.tenderer.id} className="rounded-md border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-semibold">{item.tenderer.name}</h3>
              <RiskBandBadge band={riskBandFor(item.score.score)} />
            </div>
            <p className="num mt-3 text-right text-[32px] font-bold leading-none">
              {item.score.score.toFixed(1)}
              <span className="text-sm font-normal text-muted-ink"> / 100</span>
            </p>
            <dl className="mt-4 grid gap-2 text-xs text-muted-ink sm:grid-cols-3">
              <div>
                <dt>{t("scoringMode")}</dt>
                <dd className="mt-1 font-medium text-ink">
                  {t(`modes.${item.score.scoringMode}`)}
                </dd>
              </div>
              <div>
                <dt>{t("configVersion")}</dt>
                <dd className="num mt-1 text-right font-medium text-ink">
                  {item.score.configVersion}
                </dd>
              </div>
              <div>
                <dt>{t("computedAt")}</dt>
                <dd className="num mt-1 text-right font-medium text-ink">
                  {formatDate(item.score.computedAt, locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold">{t("breakdown")}</h3>
        <div>
          <label htmlFor="score-compare" className="block text-[13px] font-medium">
            {t("compareWith")}
          </label>
          <select
            id="score-compare"
            value={comparison?.tenderer.id ?? ""}
            onChange={(event) => onCompare(event.target.value || null)}
            className="mt-1 h-9 min-w-52 rounded-md border border-line-strong bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
          >
            <option value="">{t("noComparison")}</option>
            {tenderers
              .filter((item) => item.tenderer.id !== primary.tenderer.id)
              .map((item) => (
                <option key={item.tenderer.id} value={item.tenderer.id}>
                  {item.tenderer.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-ink">
        {items.map((item, index) => (
          <span key={item.tenderer.id} className="inline-flex items-center gap-2">
            <span
              className={index === 0 ? "size-3 bg-clay-600" : "size-3 bg-ink"}
              aria-hidden="true"
            />
            {item.tenderer.name}
          </span>
        ))}
      </div>
      <div className="mt-2 h-[390px] min-w-0 overflow-hidden" aria-hidden="true">
        <ScoreSignalPlot items={items} signalKeys={signalKeys} labels={labels} />
      </div>
      <table className="num mt-4 w-full border-collapse text-sm">
        <caption className="mb-2 text-left text-xs text-muted-ink">
          {t("tableCaption")}
        </caption>
        <thead className="bg-stone-50 text-[13px] text-muted-ink">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("signal")}
            </th>
            {items.map((item) => (
              <th
                key={item.tenderer.id}
                scope="col"
                className="px-3 py-2 text-right font-medium"
              >
                {item.tenderer.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signalKeys.map((key) => (
            <tr key={key} className="border-b border-line align-top">
              <th scope="row" className="px-3 py-3 text-left font-medium">
                {labels[key]}
              </th>
              {items.map((item) => {
                const signal = item.score.signals.find(
                  (entry) => entry.signal === key,
                );
                return (
                  <td key={item.tenderer.id} className="px-3 py-3 text-right">
                    {signal?.dataSufficient ? (
                      <>
                        <span className="font-semibold">
                          {t("points", {
                            points: number.format(signal.contribution),
                          })}
                        </span>
                        <span className="block text-xs text-muted-ink">
                          {t("signalValues", {
                            weight: formatPercent(signal.weight, locale),
                            raw: number.format(signal.rawValue),
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-ink">
                        <CircleDashed size={14} aria-hidden="true" />
                        {t("insufficient")}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mt-6" aria-labelledby="signal-flags-heading">
        <h3 id="signal-flags-heading" className="text-base font-semibold">
          {t("relatedFlags")}
        </h3>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {signalKeys.map((key) => (
            <div key={key} className="py-3">
              <h4 className="font-medium">{labels[key]}</h4>
              {items.map((item) => {
                const related = flags.filter(
                  (flag) =>
                    flag.tendererId === item.tenderer.id && flag.signal === key,
                );
                return (
                  <div key={item.tenderer.id} className="mt-2 pl-3">
                    {comparison && (
                      <p className="text-xs font-medium text-muted-ink">
                        {item.tenderer.name}
                      </p>
                    )}
                    {related.length ? (
                      <ul className="mt-1 space-y-2">
                        {related.map((flag) => (
                          <li key={flag.id}>
                            {flag.evidence.length ? (
                              <button
                                type="button"
                                onClick={() => onEvidence(flag.id)}
                                className="inline-flex items-center gap-2 rounded-sm text-left text-sm text-clay-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                              >
                                <SeverityBadge severity={flag.severity} />
                                <span>{flag.title}</span>
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </button>
                            ) : (
                              <p className="text-sm text-risk">
                                {t("missingEvidence")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted-ink">
                        {t("noFlags")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
