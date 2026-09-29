"use client";
import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  ErrorState,
  SeverityBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from "@/components/ui";
import { useSession } from "@/lib/auth/session";
import {
  formatDate,
  formatPercent,
  formatSigma,
  type FormatLocale,
} from "@/lib/format";
import type { DispositionInput, Flag } from "@/schemas";
import { useFlagDisposition } from "@/features/flags";
import { useFlagActivity } from "../api";
import { EvidenceViewer } from "./evidence-viewer";
import { DispositionPanel } from "./disposition-panel";

function thresholdText(
  flag: Flag,
  t: ReturnType<typeof useTranslations<"Evidence">>,
) {
  if (!flag.threshold) return null;
  if (flag.threshold.kind === "sigma")
    return flag.zScore === undefined
      ? t("sigmaThresholdOnly", { threshold: flag.threshold.value.toFixed(1) })
      : t("sigmaComparison", {
          actual: formatSigma(flag.zScore),
          threshold: flag.threshold.value.toFixed(1),
        });
  const value =
    flag.threshold.value > 1
      ? flag.threshold.value / 100
      : flag.threshold.value;
  return t("percentThresholdOnly", { threshold: formatPercent(value) });
}

export function FlagEvidenceContent({ flag }: { flag: Flag }) {
  const t = useTranslations("Evidence");
  const auditors = useTranslations("Auditors");
  const signals = useTranslations("ScoreDetail.signals");
  const locale = useLocale() as FormatLocale;
  const toast = useToast();
  const session = useSession();
  const disposition = useFlagDisposition(
    flag.projectId,
    session.data?.id ?? "",
  );
  const activity = useFlagActivity(flag.projectId, flag.id);
  const [saveError, setSaveError] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState(
    flag.evidence[0]?.id ?? "",
  );
  const history = useMemo(() => {
    const items = [
      {
        id: `${flag.id}:created`,
        at: flag.createdAt,
        label: t("created"),
        detail: "",
      },
      ...(flag.proposal
        ? [
            {
              id: `${flag.id}:proposal`,
              at: flag.proposal.at,
              label: t("proposal"),
              detail: flag.proposal.reason,
            },
          ]
        : []),
      ...(flag.decision
        ? [
            {
              id: `${flag.id}:decision`,
              at: flag.decision.at,
              label: t("finalDecision"),
              detail: flag.decision.reason,
            },
          ]
        : []),
      ...(activity.data ?? [])
        .filter(
          (event) =>
            !(
              (event.action === "flag.proposal" &&
                flag.proposal?.at === event.at) ||
              (event.action === "flag.decision" &&
                flag.decision?.at === event.at)
            ),
        )
        .map((event) => ({
          id: event.id,
          at: event.at,
          label:
            event.action === "flag.proposal"
              ? t("proposal")
              : event.action === "flag.decision"
                ? t("finalDecision")
                : t("activityUpdate"),
          detail: "",
        })),
    ];
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [activity.data, flag, t]);
  async function submit(
    kind: "proposal" | "decision",
    input: DispositionInput,
  ) {
    setSaveError(false);
    try {
      await disposition.mutateAsync({ flagId: flag.id, kind, ...input });
      toast(
        t(kind === "proposal" ? "proposalSaved" : "decisionSaved"),
        "success",
      );
      return true;
    } catch {
      setSaveError(true);
      return false;
    }
  }
  if (flag.evidence.length === 0) return <ErrorState message={t("missing")} />;
  const chosen =
    flag.evidence.find((item) => item.id === activeEvidence) ??
    flag.evidence[0];
  return (
    <>
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold leading-6">{flag.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SeverityBadge severity={flag.severity} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="num inline-flex items-center gap-1 rounded-sm text-sm text-muted-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                  >
                    {t("confidenceValue", {
                      value: formatPercent(flag.confidence, locale),
                    })}
                    <Info size={14} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("confidenceHelp")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="mt-2 grid gap-1 text-xs text-muted-ink sm:grid-cols-2">
            <p>
              {t("auditor")}: {auditors(flag.auditor)}
            </p>
            <p>
              {t("signal")}: {signals(flag.signal)}
            </p>
          </div>
          {flag.threshold && (
            <p className="num mt-3 text-sm font-medium text-caution">
              {thresholdText(flag, t)}
            </p>
          )}
          <p className="mt-3 max-w-prose text-sm text-muted-ink">
            {flag.description}
          </p>
        </div>
        <section aria-label={t("source")}>
          <h3 className="text-base font-semibold">{t("source")}</h3>
          {flag.evidence.length > 1 ? (
            <Tabs
              value={chosen.id}
              onValueChange={setActiveEvidence}
              className="mt-3"
            >
              <TabsList>
                {flag.evidence.map((item, index) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {t("evidenceTab", { number: index + 1 })}
                  </TabsTrigger>
                ))}
              </TabsList>
              {flag.evidence.map((item) => (
                <TabsContent key={item.id} value={item.id}>
                  <EvidenceViewer evidence={item} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="mt-3">
              <EvidenceViewer evidence={chosen} />
            </div>
          )}
          <p className="mt-3 text-xs text-muted-ink">
            {t("document", { id: chosen.documentId })}
          </p>
          <p className="mt-3 text-[13px] font-medium">{t("excerpt")}</p>
          <blockquote className="mt-1 border-l-2 border-clay-600 bg-limewash-100 px-3 py-2 text-sm">
            {chosen.excerpt}
          </blockquote>
        </section>
        {chosen.calculation && (
          <section
            aria-label={t("calculation")}
            className="rounded-md border border-line bg-stone-50 p-4"
          >
            <h3 className="font-semibold">{t("calculation")}</h3>
            <p className="num mt-2 text-sm">{chosen.calculation.expression}</p>
            <dl className="mt-3 space-y-1 text-sm">
              {Object.entries(chosen.calculation.inputs).map(
                ([name, value]) => (
                  <div key={name} className="flex justify-between gap-3">
                    <dt>{name}</dt>
                    <dd className="num text-right">{value}</dd>
                  </div>
                ),
              )}
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold">
                <dt>{t("result")}</dt>
                <dd className="num text-right">{chosen.calculation.result}</dd>
              </div>
            </dl>
          </section>
        )}
        <section aria-label={t("history")}>
          <h3 className="text-base font-semibold">{t("history")}</h3>
          {activity.isError && (
            <p role="alert" className="mt-2 text-sm text-risk">
              {t("historyError")}
            </p>
          )}
          <ol className="mt-2 divide-y divide-line rounded-md border border-line bg-panel">
            {history.map((item) => (
              <li key={item.id} className="px-3 py-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{item.label}</span>
                  <time
                    className="num text-right text-xs text-muted-ink"
                    dateTime={item.at}
                  >
                    {formatDate(item.at, locale)}
                  </time>
                </div>
                {item.detail && (
                  <p className="mt-1 text-muted-ink">{item.detail}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <DispositionPanel
        flag={flag}
        user={session.data}
        pending={disposition.isPending}
        error={saveError}
        onSubmit={submit}
      />
    </>
  );
}
