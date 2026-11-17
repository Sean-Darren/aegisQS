"use client";
import { EntityActivity } from "@/components/records/entity-activity";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { queryKeys, resources } from "@/lib/api";
import { useDocument, useFile } from "@/lib/api/use-records";
import {
  Button,
  DecisionForm,
  ErrorState,
  EmptyState,
  Skeleton,
  SegmentedControl,
  StatusChip,
  AiGeneratedLabel,
  LowConfidenceNote,
} from "@/components/ui";
import { inputStyle, panelStyle } from "@/components/ui/form-styles";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { useComparison, useChanges } from "../hooks/queries";
import { nextChangeIndex } from "@/components/viewer/geometry";
import type {
  CanvasControls,
  ViewerMode,
} from "@/components/viewer/comparison-canvas";
import type { DrawingComparison, DrawingChange } from "@/schemas";
import { formatPercent } from "@/lib/format";
import { confidenceThresholds } from "@/lib/config";
import { Link } from "@/i18n/navigation";
import { CircleCheck, TriangleAlert } from "lucide-react";
const Canvas = dynamic(
  () =>
    import("@/components/viewer/comparison-canvas").then(
      (m) => m.ComparisonCanvas,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[600px] w-full" /> },
);
export function ComparisonPage({ comparisonId }: { comparisonId: string }) {
  const common = useTranslations("Common");
  const t = useTranslations("Drawing");
  const query = useComparison(comparisonId);
  if (query.isPending) return <Skeleton className="h-[650px] w-full" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        message={t("error")}
        action={{
          label: common("retry"),
          onClick: () => {
            void query.refetch();
          },
        }}
      />
    );
  return <ComparisonWorkspace key={comparisonId} comparison={query.data} />;
}
export function ComparisonWorkspace({
  comparison,
  onNavigate,
}: {
  comparison: DrawingComparison;
  /** Called when the workspace navigates away (e.g. raising a variation),
      so a hosting dialog can close itself first. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("Drawing");
  const client = useQueryClient();
  const router = useRouter();
  const session = useSession();
  const records = useDocument(comparison.documentId);
  const base = useFile(comparison.baseVersionId),
    target = useFile(comparison.targetVersionId);
  const changesQuery = useChanges(comparison.id);
  const [mode, setMode] = useState<ViewerMode>("side");
  const params = useSearchParams();
  const changeParam = params.get("change") ?? "";
  const [selected, setSelected] = useState(changeParam);
  const [syncedChangeParam, setSyncedChangeParam] = useState(changeParam);
  if (syncedChangeParam !== changeParam) {
    // Follow ?change= links even when the workspace is already mounted.
    setSyncedChangeParam(changeParam);
    setSelected(changeParam);
  }
  const [checked, setChecked] = useState<string[]>([]);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState(false);
  const [draft, setDraft] = useState(comparison.alignment);
  const [error, setError] = useState(false);
  const [raising, setRaising] = useState(false);
  const controls = useRef<CanvasControls | null>(null);
  const assign = useCallback((value: CanvasControls) => {
    controls.current = value;
  }, []);
  const changes = changesQuery.data ?? [];
  const visible = changes.filter(
    (c) => (!kind || c.kind === kind) && (!status || c.status === status),
  );
  const active = changes.find((c) => c.id === selected) ?? visible[0];
  const versions = records.versions.data ?? [];
  const baseVersion = versions.find((v) => v.id === comparison.baseVersionId),
    targetVersion = versions.find((v) => v.id === comparison.targetVersionId);
  function select(id: string) {
    setSelected(id);
    const change = changes.find((c) => c.id === id);
    if (change) {
      setPage(change.page);
      controls.current?.focus(change);
    }
  }
  function navigate(key: string) {
    const index = visible.findIndex((c) => c.id === active?.id);
    const next = nextChangeIndex(index, key, visible.length);
    if (next >= 0) select(visible[next].id);
  }
  const review = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: DrawingChange["status"];
      note?: string;
    }) => resources.reviewChange(id, { status, note }),
    onMutate: async (input) => {
      await client.cancelQueries({
        queryKey: queryKeys.changes(comparison.id),
      });
      const previous = client.getQueryData<DrawingChange[]>(
        queryKeys.changes(comparison.id),
      );
      client.setQueryData<DrawingChange[]>(
        queryKeys.changes(comparison.id),
        (old) =>
          old?.map((c) =>
            c.id === input.id ? { ...c, status: input.status } : c,
          ),
      );
      return { previous };
    },
    onError: (_e, _input, context) => {
      client.setQueryData(queryKeys.changes(comparison.id), context?.previous);
      setError(true);
    },
    onSettled: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.changes(comparison.id),
      });
      void client.invalidateQueries({
        queryKey: queryKeys.auditEvents(comparison.projectId),
      });
    },
  });
  async function raise() {
    setRaising(true);
    setError(false);
    try {
      const created = await resources.raiseVariation(comparison.projectId, {
        title: changes
          .filter((c) => checked.includes(c.id))
          .map((c) => c.summary)
          .join("; "),
        sourceChangeIds: checked,
        comparisonId: comparison.id,
      });
      void client.invalidateQueries({
        queryKey: queryKeys.project(comparison.projectId),
      });
      void client.invalidateQueries({
        queryKey: queryKeys.changes(comparison.id),
      });
      onNavigate?.();
      router.push(`/projects/${comparison.projectId}/variations/${created.id}`);
    } catch {
      setError(true);
    } finally {
      setRaising(false);
    }
  }
  if (["queued", "aligning", "detecting"].includes(comparison.status))
    return (
      <section className={panelStyle}>
        <h1 className="text-2xl font-semibold">{t("comparing")}</h1>
        <div role="status" aria-live="polite">
          <p>
            {t(`jobs.${comparison.status}`)} ·{" "}
            <span className="tabular-nums">{comparison.progressPct}%</span>
          </p>
          <progress
            className="w-full accent-clay-700"
            max={100}
            value={comparison.progressPct}
          />
        </div>
        <p>{t("leaveSafe")}</p>
      </section>
    );
  if (comparison.status === "failed")
    return <ErrorState message={`${t("error")} ${comparison.error ?? ""}`} />;
  return (
    <div
      className="space-y-4"
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "input,textarea,select,button,[role=combobox]",
          )
        )
          return;
        const key = event.key;
        if (["j", "k", "J", "K"].includes(key)) {
          event.preventDefault();
          navigate(key);
        } else if (key === "+" || key === "=") {
          event.preventDefault();
          controls.current?.setZoom(zoom + 0.25);
        } else if (key === "-") {
          event.preventDefault();
          controls.current?.setZoom(zoom - 0.25);
        } else if (key.startsWith("Arrow")) {
          event.preventDefault();
          controls.current?.pan(
            key === "ArrowLeft" ? 30 : key === "ArrowRight" ? -30 : 0,
            key === "ArrowUp" ? 30 : key === "ArrowDown" ? -30 : 0,
          );
        }
      }}
    >
      <header className="space-y-3 rounded-md bg-ink p-4 text-limewash">
        <h1 className="text-lg font-semibold">
          {records.document.data?.docNumber} · {records.document.data?.title} ·{" "}
          {t("revisionPair", {
            base: baseVersion?.label ?? "…",
            target: targetVersion?.label ?? "…",
          })}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label={t("mode")}
            value={mode}
            onValueChange={(value) => setMode(value as ViewerMode)}
            options={[
              { value: "side", label: t("side") },
              { value: "overlay", label: t("overlay") },
              { value: "swipe", label: t("swipe") },
            ]}
          />
          <Button
            variant="on-ink"
            onClick={() => controls.current?.setZoom(zoom - 0.25)}
            aria-label={t("zoomOut")}
          >
            −
          </Button>
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button
            variant="on-ink"
            onClick={() => controls.current?.setZoom(zoom + 0.25)}
            aria-label={t("zoomIn")}
          >
            +
          </Button>
          <Button variant="on-ink" onClick={() => controls.current?.fit()}>
            {t("fit")}
          </Button>
          <Button variant="on-ink" onClick={() => navigate("k")}>
            {t("previous")}
          </Button>
          <Button variant="on-ink" onClick={() => navigate("j")}>
            {t("next")}
          </Button>
          <span className="inline-flex items-center gap-1 rounded-full bg-sidebar-hover px-2 py-1 text-xs tabular-nums">
            {comparison.alignment.quality < confidenceThresholds.alignment ? (
              <TriangleAlert size={14} aria-hidden="true" />
            ) : (
              <CircleCheck size={14} aria-hidden="true" />
            )}
            {t("alignment")} ·{" "}
            {t(`alignmentMethods.${comparison.alignment.method}`)} ·{" "}
            {comparison.alignment.quality.toFixed(2)}
          </span>
          {can(session.data, "comparison.run") && (
            <Button
              variant="on-ink"
              className={
                comparison.alignment.quality < confidenceThresholds.alignment
                  ? "bg-caution-bg text-caution hover:bg-caution-bg"
                  : undefined
              }
              onClick={() => setAdjust((v) => !v)}
            >
              {comparison.alignment.quality < confidenceThresholds.alignment
                ? t("alignmentWeak")
                : t("adjust")}
            </Button>
          )}
        </div>
      </header>
      {comparison.alignment.quality < confidenceThresholds.alignment && (
        <LowConfidenceNote
          kind="alignment"
          confidence={comparison.alignment.quality}
        />
      )}
      {adjust && (
        <section className={panelStyle}>
          <h2>{t("adjust")}</h2>
          <div className="grid grid-cols-4 gap-3">
            {(["dx", "dy", "scale", "rotationDeg"] as const).map((key) => (
              <label key={key}>
                {t(`alignmentFields.${key}`)}
                <input
                  type="number"
                  step={key === "scale" ? 0.01 : 1}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))
                  }
                  className={inputStyle}
                />
              </label>
            ))}
          </div>
          <Button
            onClick={async () => {
              try {
                const c = await resources.updateAlignment(comparison.id, draft);
                client.setQueryData(queryKeys.comparison(c.id), c);
                setAdjust(false);
              } catch {
                setError(true);
              }
            }}
          >
            {t("saveAlignment")}
          </Button>
        </section>
      )}
      {error && <ErrorState message={t("error")} />}
      {comparison.pageCount > 1 && (
        <label>
          {t("page")}
          <select
            className={inputStyle}
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
          >
            {Array.from({ length: comparison.pageCount }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section
          tabIndex={0}
          aria-label={t("canvasHelp")}
          className="min-w-0 overflow-hidden rounded-md border border-line focus-visible:outline-2 focus-visible:outline-clay-600"
        >
          {base.isError || target.isError ? (
            <ErrorState message={t("pdfError")} />
          ) : base.data && target.data ? (
            <Canvas
              base={base.data}
              target={target.data}
              mode={mode}
              page={page}
              baseLabel={t("baseCaption", {
                revision: baseVersion?.label ?? "…",
              })}
              targetLabel={t("targetCaption", {
                revision: targetVersion?.label ?? "…",
              })}
              baseMimeType={baseVersion?.mimeType}
              targetMimeType={targetVersion?.mimeType}
              alignment={adjust ? draft : comparison.alignment}
              onControls={assign}
              onZoom={setZoom}
            />
          ) : (
            <Skeleton className="h-[600px] w-full" />
          )}
          {mode === "overlay" && (
            <p className="flex gap-4 bg-panel p-2 text-xs">
              <span className="text-rev-base">{t("removedLegend")}</span>
              <span className="text-rev-target">{t("addedLegend")}</span>
              <span>{t("bothLegend")}</span>
            </p>
          )}
          <p className="bg-panel p-3 text-xs text-muted-ink">
            {t("canvasHelp")}
          </p>
        </section>
        <aside className="space-y-4 rounded-lg border border-line bg-panel p-4">
          <h2 className="text-lg font-semibold">
            {t("changes", { count: changes.length })}
          </h2>
          <label>
            {t("kind")}
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={inputStyle}
            >
              <option value="">{t("all")}</option>
              {[...new Set(changes.map((c) => c.kind))].map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("status")}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputStyle}
            >
              <option value="">{t("all")}</option>
              {["new", "no_variation", "potential_variation"].map((k) => (
                <option key={k} value={k}>
                  {t(`statuses.${k}`)}
                </option>
              ))}
            </select>
          </label>
          {changesQuery.isError && <ErrorState message={t("error")} />}
          {visible.length === 0 && <EmptyState message={t("noChanges")} />}
          <ol className="space-y-2">
            {visible.map((change) => (
              <li
                key={change.id}
                className={`rounded-md border p-3 ${active?.id === change.id ? "border-clay-600 bg-limewash-100" : "border-line"}`}
              >
                <div className="flex items-center gap-2">
                  {can(session.data, "variation.raise") &&
                    !change.variationEventId && (
                      <input
                        type="checkbox"
                        aria-label={t("selectChange", {
                          number: change.number,
                        })}
                        checked={checked.includes(change.id)}
                        onChange={(e) =>
                          setChecked((old) =>
                            e.target.checked
                              ? [...old, change.id]
                              : old.filter((id) => id !== change.id),
                          )
                        }
                      />
                    )}
                  <button
                    onClick={() => select(change.id)}
                    className="text-left focus-visible:outline-2 focus-visible:outline-clay-600"
                  >
                    <span className="tabular-nums">△{change.number}</span>{" "}
                    <StatusChip domain="changeKind" value={change.kind} />
                    <p className="mt-2 text-sm">{change.summary}</p>
                    {(change.textBefore || change.textAfter) && (
                      <p className="mt-1 text-xs tabular-nums text-muted-ink">
                        {change.textBefore && <del>{change.textBefore}</del>}
                        {change.textBefore && change.textAfter ? " → " : ""}
                        {change.textAfter}
                      </p>
                    )}
                  </button>
                </div>
                <AiGeneratedLabel />
                <p className="text-xs tabular-nums">
                  {t("confidence")} {formatPercent(change.confidence)}
                </p>
                <LowConfidenceNote confidence={change.confidence} />
                <StatusChip domain="changeStatus" value={change.status} />
              </li>
            ))}
          </ol>
          {active && (
            <section className="space-y-3 border-t border-line pt-3">
              <h3 className="font-semibold">{active.summary}</h3>
              <AiGeneratedLabel />
              {(active.textBefore || active.textAfter) && (
                <p className="tabular-nums">
                  <del>{active.textBefore}</del> → {active.textAfter}
                </p>
              )}
              {active.variationEventId && (
                <Link
                  className="text-clay-700 underline"
                  href={`/projects/${comparison.projectId}/variations/${active.variationEventId}`}
                >
                  {active.variationEventId}
                </Link>
              )}
              {can(session.data, "change.review") && (
                <DecisionForm
                  key={active.id}
                  actions={[
                    { value: "no_variation", label: t("noVariation") },
                    { value: "potential_variation", label: t("potential") },
                  ]}
                  actionLabel={t("review")}
                  reasonLabel={t("optionalNote")}
                  submitLabel={t("saveReview")}
                  errorMessage={t("error")}
                  minReasonLength={0}
                  pending={review.isPending}
                  onSubmit={({ action, reason }) =>
                    review.mutate({
                      id: active.id,
                      status: action as DrawingChange["status"],
                      note: reason,
                    })
                  }
                />
              )}
            </section>
          )}
          {can(session.data, "variation.raise") && (
            <span title={!checked.length ? t("selectFirst") : undefined}>
              <Button
                disabled={!checked.length || raising}
                onClick={() => void raise()}
              >
                {t("raise", { count: checked.length })}
              </Button>
            </span>
          )}
        </aside>
      </div>
      <EntityActivity
        projectId={comparison.projectId}
        entities={[
          { type: "comparison", id: comparison.id },
          ...changes.map((c) => ({ type: "change" as const, id: c.id })),
        ]}
      />
    </div>
  );
}
