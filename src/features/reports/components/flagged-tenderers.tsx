"use client";
import { useTranslations } from "next-intl";
import { SeverityBadge } from "@/components/ui/status-badges";
import { ErrorState } from "@/components/ui/states";
import type { Flag, Tenderer } from "@/schemas";
import { citedFlags } from "../model";

export function FlaggedTenderers({
  flags,
  tenderers,
  onOpenEvidence,
  inlineEvidence = false,
}: {
  flags: Flag[];
  tenderers: Tenderer[];
  onOpenEvidence?: (flagId: string) => void;
  inlineEvidence?: boolean;
}) {
  const t = useTranslations("Reports");
  const cited = citedFlags(flags);
  const missing = flags.length - cited.length;
  const byTenderer = new Map<string, Flag[]>();
  for (const flag of cited) {
    const key = flag.tendererId ?? "project";
    byTenderer.set(key, [...(byTenderer.get(key) ?? []), flag]);
  }
  const names = new Map(
    tenderers.map((tenderer) => [tenderer.id, tenderer.name]),
  );
  return (
    <section
      aria-labelledby="flagged-tenderers-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <h2
        id="flagged-tenderers-title"
        className="text-lg font-semibold text-ink"
      >
        {t("flaggedTenderers")}
      </h2>
      <p className="mt-1 text-sm text-muted-ink">{t("flaggedHelp")}</p>
      {missing > 0 && (
        <div className="mt-4">
          <ErrorState message={t("missingEvidence", { count: missing })} />
        </div>
      )}
      {byTenderer.size === 0 ? (
        <p className="mt-4 text-sm text-muted-ink">{t("noCitedFlags")}</p>
      ) : (
        <div className="mt-4 divide-y divide-line border-y border-line">
          {[...byTenderer].map(([tendererId, entries]) => (
            <details key={tendererId} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600">
                <span>{names.get(tendererId) ?? t("projectWide")}</span>
                <span className="num text-sm font-normal text-muted-ink">
                  {t("flagCount", { count: entries.length })}
                </span>
              </summary>
              <ul className="mt-3 space-y-3">
                {entries.map((flag) => (
                  <li
                    key={flag.id}
                    className="rounded-md border border-line bg-stone-50 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={flag.severity} />
                      <strong className="font-semibold text-ink">
                        {flag.title}
                      </strong>
                    </div>
                    <p className="mt-2 max-w-prose text-muted-ink">
                      {flag.description}
                    </p>
                    {flag.decision && (
                      <p className="mt-2 max-w-prose text-ink">
                        <span className="font-medium">
                          {t("decisionReason")}:{" "}
                        </span>
                        {flag.decision.reason}
                      </p>
                    )}
                    {onOpenEvidence && (
                      <button
                        data-evidence-trigger={flag.id}
                        className="mt-2 rounded-sm text-clay-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                        onClick={() => onOpenEvidence(flag.id)}
                      >
                        {t("viewEvidence")}
                      </button>
                    )}
                    {inlineEvidence && (
                      <details className="mt-2">
                        <summary className="cursor-pointer rounded-sm text-clay-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600">
                          {t("viewEvidence")}
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {flag.evidence.map((item) => (
                            <li
                              key={item.id}
                              className="rounded-md border border-line bg-panel p-3"
                            >
                              <p className="text-ink">{item.excerpt}</p>
                              <p className="num mt-1 text-xs text-muted-ink">
                                {item.page
                                  ? t("sourcePage", { page: item.page })
                                  : item.boqItemRef
                                    ? t("boqRef", { ref: item.boqItemRef })
                                    : t("sourceDocument")}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
