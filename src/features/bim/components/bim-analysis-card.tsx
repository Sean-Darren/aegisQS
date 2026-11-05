"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Dropzone, ErrorState, Skeleton } from "@/components/ui";
import { formatCurrency, formatNumber, formatUnitRate } from "@/lib/format";
import { type BimBoqItem, type BimResult } from "@/schemas";
import {
  bimWorkerUrl,
  connectBimProgress,
  getBimJob,
  startBimAssessment,
} from "../api";

type Phase = "idle" | "uploading" | "running" | "done" | "error";

const supportedExtensions = [".ifc", ".pdf", ".json", ".png", ".jpg", ".jpeg"];

function isSupportedFile(file: File) {
  return supportedExtensions.some((extension) =>
    file.name.toLowerCase().endsWith(extension),
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative grid size-24 place-items-center">
      <svg
        aria-hidden="true"
        className="size-24 -rotate-90"
        viewBox="0 0 80 80"
      >
        <circle
          className="stroke-line"
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="8"
        />
        <circle
          className="stroke-clay-600 transition-[stroke-dashoffset] duration-500"
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-xl font-semibold">{Math.round(score)}%</span>
    </div>
  );
}

function issueCounts(result: BimResult) {
  const counts = { blocker: 0, high: 0, medium: 0, low: 0 };
  for (const issue of result.report.issues ?? []) {
    const severity = issue.severity.toLowerCase();
    if (severity === "blocker") counts.blocker += 1;
    if (severity === "high") counts.high += 1;
    if (severity === "medium") counts.medium += 1;
    if (severity === "low") counts.low += 1;
  }
  return counts;
}

function BoqTable({ items }: { items: BimBoqItem[] }) {
  const t = useTranslations("Bim");
  if (!items.length) {
    return <p className="mt-4 text-sm text-muted-ink">{t("noBoq")}</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-stone-50 text-left text-xs font-medium text-muted-ink">
          <tr>
            <th className="border-b border-line px-3 py-2">{t("boqCode")}</th>
            <th className="border-b border-line px-3 py-2">{t("boqElement")}</th>
            <th className="border-b border-line px-3 py-2">{t("boqDescription")}</th>
            <th className="border-b border-line px-3 py-2 text-right">
              {t("boqQuantity")}
            </th>
            <th className="border-b border-line px-3 py-2">{t("boqUnit")}</th>
            <th className="border-b border-line px-3 py-2 text-right">
              {t("boqRate")}
            </th>
            <th className="border-b border-line px-3 py-2 text-right">
              {t("boqTotal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const unit = item.unit?.trim() || "No.";
            const rate = item.rate ?? item.rate_applied ?? 0;
            const quantity = item.quantity ?? 0;
            const total = item.total_price ?? quantity * rate;
            return (
              <tr key={item.item_id} className="align-top">
                <td className="border-b border-line px-3 py-2 text-xs text-muted-ink">
                  {item.price_book_item_code ||
                    item.material_code ||
                    item.item_id}
                </td>
                <td className="border-b border-line px-3 py-2">
                  {item.bim_element || item.material_family || item.trade || "—"}
                </td>
                <td className="border-b border-line px-3 py-2">
                  {item.description || "—"}
                </td>
                <td className="border-b border-line px-3 py-2 text-right tabular-nums">
                  {formatNumber(quantity)}
                </td>
                <td className="border-b border-line px-3 py-2">{unit}</td>
                <td className="border-b border-line px-3 py-2 text-right tabular-nums">
                  {formatUnitRate(rate, unit)}
                </td>
                <td className="border-b border-line px-3 py-2 text-right tabular-nums">
                  {formatCurrency(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultView({ result }: { result: BimResult }) {
  const t = useTranslations("Bim");
  const counts = issueCounts(result);
  const elementCount =
    result.report.element_count ?? result.elements?.length ?? 0;
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-4 sm:flex-row sm:items-center">
        <ScoreRing score={result.report.overall_score} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("readyGate")}</p>
          <p className="mt-1 text-sm text-muted-ink">
            {result.report.gate_state || "—"}
          </p>
          <p className="mt-2 text-xs text-muted-ink">
            {t("issueSummary", { ...counts, elements: elementCount })}
          </p>
          {result.report.summary ? (
            <p className="mt-2 text-xs text-muted-ink">{result.report.summary}</p>
          ) : null}
        </div>
      </div>
      <section className="space-y-3">
        <h3 className="text-base font-semibold">{t("boq")}</h3>
        <BoqTable items={result.boq ?? []} />
      </section>
    </div>
  );
}

export function BimAnalysisCard() {
  const t = useTranslations("Bim");
  const [file, setFile] = useState<File>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<BimResult>();

  const progressText = useMemo(() => {
    if (phase === "uploading") return t("uploading");
    if (phase === "running") return `${statusMessage || t("running")} · ${progress}%`;
    if (phase === "done") return t("complete");
    return null;
  }, [phase, progress, statusMessage, t]);

  function reset() {
    setFile(undefined);
    setPhase("idle");
    setProgress(0);
    setStatusMessage("");
    setError(undefined);
    setResult(undefined);
  }

  async function analyze() {
    if (!file) return;
    if (!isSupportedFile(file)) {
      setError(t("rejected"));
      return;
    }
    setPhase("uploading");
    setProgress(0);
    setStatusMessage("");
    setError(undefined);
    setResult(undefined);
    try {
      const job = await startBimAssessment(file);
      setPhase("running");
      connectBimProgress(
        job.job_id,
        (event) => {
          setProgress(event.progress ?? 0);
          setStatusMessage(event.message ?? "");
          if (event.type === "bim.completed") {
            void getBimJob(job.job_id)
              .then((snapshot) => {
                setResult(snapshot.result ?? undefined);
                setPhase("done");
              })
              .catch((requestError: unknown) => {
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : t("error"),
                );
                setPhase("error");
              });
          }
          if (event.type === "bim.failed") {
            setError(event.error ?? event.message ?? t("error"));
            setPhase("error");
          }
        },
        (socketError) => {
          setError(socketError.message);
          setPhase("error");
        },
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t("error"),
      );
      setPhase("error");
    }
  }

  return (
    <section
      aria-labelledby="bim-analysis-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <div className="flex flex-col gap-2">
        <h2 id="bim-analysis-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-ink">{t("description")}</p>
        <p className="text-xs text-muted-ink">
          {t("worker", { url: bimWorkerUrl })}
        </p>
      </div>

      {phase !== "done" && (
        <div className="mt-4 space-y-3">
          <Dropzone
            label={t("dropzone")}
            multiple={false}
            accept={{
              "application/pdf": [".pdf"],
              "application/json": [".json"],
              "image/png": [".png"],
              "image/jpeg": [".jpg", ".jpeg"],
              "application/octet-stream": [".ifc"],
            }}
            disabled={phase === "uploading" || phase === "running"}
            onFiles={(files) => {
              const next = files[0];
              if (!next) return;
              setFile(next);
              setResult(undefined);
            }}
            onRejected={() => setError(t("rejected"))}
          />
          {file ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 truncate text-sm">{file.name}</p>
              <Button
                className="shrink-0"
                onClick={() => void analyze()}
                disabled={phase === "uploading" || phase === "running"}
              >
                {t("analyze")}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {phase === "uploading" || phase === "running" ? (
        <div className="mt-4">
          {phase === "uploading" ? (
            <Skeleton className="h-3 w-full" />
          ) : (
            <progress
              className="w-full"
              value={progress}
              max={100}
              aria-label={t("analyzing")}
            />
          )}
          {progressText ? (
            <p className="mt-2 text-sm text-muted-ink">{progressText}</p>
          ) : null}
        </div>
      ) : null}

      {phase === "error" && error ? (
        <div className="mt-4">
          <ErrorState
            message={error}
            action={{ label: t("retry"), onClick: reset }}
          />
        </div>
      ) : null}

      {phase === "done" && result ? <ResultView result={result} /> : null}

      {phase === "done" ? (
        <Button className="mt-4" variant="outline" onClick={reset}>
          {t("another")}
        </Button>
      ) : phase === "error" && file ? (
        <Button className="mt-3" variant="secondary" onClick={() => void analyze()}>
          {t("retry")}
        </Button>
      ) : null}
    </section>
  );
}
