"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { queryKeys, resources } from "@/lib/api";
import {
  Actor,
  Button,
  AiGeneratedLabel,
  DecisionForm,
  Combobox,
  Skeleton,
  ErrorState,
  StatusChip,
} from "@/components/ui";
import { ComparisonDialog } from "@/features/drawings/components/comparison-dialog";
import { panelStyle, inputStyle } from "@/components/ui/form-styles";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  formatCurrency,
  formatRange,
  formatUnitRate,
  formatDate,
  type FormatLocale,
} from "@/lib/format";
import { LinkedRecords, recordHref } from "@/components/records/linked-records";
import { EntityActivity } from "@/components/records/entity-activity";
import { PdfViewer } from "@/components/viewer";
import { useFile } from "@/lib/api/use-records";
import { indicativeCost, costAmount } from "../model";
import type { VariationEvent, CostLine, DrawingChange } from "@/schemas";
export function VariationPage({ variationId }: { variationId: string }) {
  const t = useTranslations("Variation");
  const session = useSession();
  const query = useQuery({
    queryKey: queryKeys.variation(variationId),
    queryFn: () => resources.variation(variationId),
  });
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError || !query.data) return <ErrorState message={t("error")} />;
  return (
    <VariationEditor
      key={`${variationId}:${session.data?.id ?? "loading"}`}
      variation={query.data}
    />
  );
}
function SourceThumbnail({
  change,
  comparisonId,
  onFocus,
}: {
  change: DrawingChange;
  comparisonId: string;
  onFocus: (comparisonId: string, changeId: string) => void;
}) {
  const t = useTranslations("Variation");
  const comparison = useQuery({
    queryKey: queryKeys.comparison(comparisonId),
    queryFn: () => resources.comparison(comparisonId),
  });
  const file = useFile(comparison.data?.targetVersionId ?? "");
  return (
    <button
      type="button"
      onClick={() => onFocus(comparisonId, change.id)}
      className="block w-full space-y-2 rounded-md border border-line p-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
    >
      <div className="relative h-36 overflow-hidden bg-viewer-bg">
        {file.data && (
          <div
            className="absolute"
            style={{
              left: -change.bbox.x * 480 + 12,
              top: -change.bbox.y * 339 + 12,
            }}
          >
            <PdfViewer
              file={file.data}
              page={change.page}
              zoom={1}
              loading={t("loading")}
              error={t("error")}
              framed={false}
            />
          </div>
        )}
      </div>
      <p>{change.summary}</p>
      <AiGeneratedLabel />
    </button>
  );
}
type Draft = { line: CostLine; quantity: string; rate: string };
function VariationEditor({ variation }: { variation: VariationEvent }) {
  const t = useTranslations("Variation");
  const locale = useLocale() as FormatLocale;
  const [focus, setFocus] = useState<{
    comparisonId: string;
    changeId: string;
  }>();
  const client = useQueryClient();
  const session = useSession();
  const changes = useQuery({
    queryKey: queryKeys.changes(variation.comparisonId),
    queryFn: () => resources.changes(variation.comparisonId),
  });
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    variation.costLines.map((line) => ({
      line,
      quantity: String(line.quantityDelta),
      rate: String(line.rate),
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  const boq = useQuery({
    queryKey: queryKeys.boqItems(variation.projectId, search),
    queryFn: () => resources.boqItems(variation.projectId, search),
  });
  const allItems = useQuery({
    queryKey: queryKeys.boqItems(variation.projectId),
    queryFn: () => resources.boqItems(variation.projectId),
  });
  const valid = drafts.every(
    (d) =>
      d.quantity.trim() !== "" &&
      d.rate.trim() !== "" &&
      Number.isFinite(Number(d.quantity)) &&
      Number.isFinite(Number(d.rate)) &&
      Number(d.rate) >= 0,
  );
  const lines = drafts.map((d) => ({
    ...d.line,
    quantityDelta: Number(d.quantity) || 0,
    rate: Number(d.rate) || 0,
    amount: valid ? costAmount(Number(d.quantity), Number(d.rate)) : 0,
  }));
  const computed = dirty
    ? indicativeCost(lines)
    : (variation.indicativeCost ?? indicativeCost(lines));
  const editable = can(session.data, "variation.editCost");
  async function save() {
    setSaving(true);
    setError(false);
    try {
      const result = await resources.updateCostLines(variation.id, lines);
      client.setQueryData(queryKeys.variation(variation.id), result);
      setDirty(false);
      void client.invalidateQueries({
        queryKey: queryKeys.project(variation.projectId),
      });
      void client.invalidateQueries({
        queryKey: queryKeys.links(variation.projectId, {
          type: "variation",
          id: variation.id,
        }),
      });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  const decision = useMutation({
    mutationFn: ({ action, reason }: { action: string; reason: string }) =>
      resources.decideVariation(variation.id, {
        status: action as "confirmed" | "rejected",
        reason,
      }),
    onMutate: async (body) => {
      await client.cancelQueries({
        queryKey: queryKeys.variation(variation.id),
      });
      const previous = client.getQueryData<VariationEvent>(
        queryKeys.variation(variation.id),
      );
      client.setQueryData<VariationEvent>(
        queryKeys.variation(variation.id),
        (old) =>
          old
            ? { ...old, status: body.action as VariationEvent["status"] }
            : old,
      );
      return { previous };
    },
    onError: (_e, _body, context) => {
      client.setQueryData(queryKeys.variation(variation.id), context?.previous);
      setError(true);
    },
    onSuccess: (result) =>
      client.setQueryData(queryKeys.variation(result.id), result),
    onSettled: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.project(variation.projectId),
      });
      void client.invalidateQueries({
        queryKey: queryKeys.variation(variation.id),
      });
    },
  });
  return (
    <div className="space-y-5">
      <Link
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-clay-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
        href={`/projects/${variation.projectId}/variations`}
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        {t("back")}
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <h1 className="text-2xl font-semibold">
            {variation.ref} · {variation.title}
          </h1>
          <StatusChip domain="variationStatus" value={variation.status} />
        </div>
        <p className="text-sm text-muted-ink">
          {variation.drawingNumber} · <Actor value={variation.raisedBy} /> ·{" "}
          {formatDate(variation.raisedAt, locale)}
        </p>
      </header>
      {error && <ErrorState message={t("error")} />}
      {variation.decision && (
        <section className="space-y-3 rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">{t("decision")}</h2>
          <p>
            {variation.decision.reason} ·{" "}
            <Actor value={variation.decision.by} /> ·{" "}
            {formatDate(variation.decision.at, locale)}
          </p>
        </section>
      )}
      {can(session.data, "variation.decide") && (
        <section className="space-y-3 rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">{t("decision")}</h2>
          {dirty && (
            <p className="text-sm text-muted-ink">{t("saveBeforeDecision")}</p>
          )}
          <DecisionForm
            actions={[
              { value: "confirmed", label: t("confirm") },
              { value: "rejected", label: t("reject") },
            ]}
            actionLabel={t("decision")}
            reasonLabel={t("reason")}
            errorMessage={t("reasonRequired")}
            submitLabel={t("recordDecision")}
            pending={decision.isPending || dirty || saving}
            onSubmit={(value) => decision.mutate(value)}
          />
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className={panelStyle}>
          <h2 className="text-lg font-semibold">{t("sources")}</h2>
          {changes.data
            ?.filter((c) => variation.sourceChangeIds.includes(c.id))
            .map((change) => (
              <SourceThumbnail
                key={change.id}
                change={change}
                comparisonId={variation.comparisonId}
                onFocus={(comparisonId, changeId) =>
                  setFocus({ comparisonId, changeId })
                }
              />
            ))}
        </section>
        <section className={panelStyle}>
          <h2 className="text-lg font-semibold">{t("indicative")}</h2>
          <p className="text-3xl font-bold tabular-nums">
            {formatCurrency(computed.total)}
          </p>
          <p className="tabular-nums">
            {formatRange(computed.low, computed.high)}
          </p>
          <div
            role="img"
            aria-label={t("rangeDescription", {
              low: formatCurrency(computed.low),
              total: formatCurrency(computed.total),
              high: formatCurrency(computed.high),
            })}
            className="relative my-4 h-5 bg-limewash-100"
          >
            <div
              className="absolute inset-y-0 border-l-2 border-clay-700"
              style={{
                left: `${computed.high === computed.low ? 50 : ((computed.total - computed.low) / (computed.high - computed.low)) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-ink">{computed.basis}</p>
          {editable && (
            <Combobox
              label={t("addItem")}
              value=""
              onSearchChange={setSearch}
              options={(boq.data ?? []).map((i) => ({
                value: i.id,
                label: `${i.itemRef} · ${i.description}`,
              }))}
              onValueChange={(id) => {
                const item = boq.data?.find((i) => i.id === id);
                if (!item) return;
                const line: CostLine = {
                  id: `cost-${Date.now()}-${++seq.current}`,
                  boqItemRef: item.itemRef,
                  description: item.description,
                  unit: item.unit,
                  quantityDelta: 0,
                  rate: item.rate ?? 0,
                  rateSource: "contract_boq",
                  amount: 0,
                  materialId: item.materialId,
                };
                setDrafts((old) => [
                  ...old,
                  { line, quantity: "0", rate: String(line.rate) },
                ]);
                setDirty(true);
                setSearch("");
              }}
            />
          )}
          {boq.isError && <ErrorState message={t("boqError")} />}
          <div className="overflow-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="bg-stone-50">
                <tr>
                  {["item", "quantity", "rate", "source", "amount"].map((k) => (
                    <th scope="col" className="p-2" key={k}>
                      {t(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft, index) => {
                  const line = lines[index];
                  return (
                    <tr key={line.id} className="border-t border-line">
                      <th scope="row" className="p-2 font-normal">
                        <p>
                          <Link
                            className="text-clay-700 underline"
                            href={recordHref(
                              variation.projectId,
                              "boq_item",
                              allItems.data?.find(
                                (i) => i.itemRef === line.boqItemRef,
                              )?.id ?? line.boqItemRef,
                            )}
                          >
                            {line.boqItemRef}
                          </Link>{" "}
                          · {line.description}
                        </p>
                        <p className="text-xs">{line.unit}</p>
                        {line.materialId && (
                          <Link
                            href={recordHref(
                              variation.projectId,
                              "material",
                              line.materialId,
                            )}
                            className="text-xs text-clay-700 underline"
                          >
                            {t("forecast")}
                          </Link>
                        )}
                      </th>
                      <td className="p-2 text-right">
                        {editable ? (
                          <input
                            aria-label={`${line.boqItemRef} ${t("quantity")}`}
                            className={`${inputStyle} min-w-24 text-right tabular-nums`}
                            type="number"
                            step="any"
                            value={draft.quantity}
                            onChange={(e) => {
                              setDrafts((old) =>
                                old.map((d, i) =>
                                  i === index
                                    ? { ...d, quantity: e.target.value }
                                    : d,
                                ),
                              );
                              setDirty(true);
                            }}
                          />
                        ) : (
                          line.quantityDelta
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {editable ? (
                          <input
                            aria-label={`${line.boqItemRef} ${t("rate")}`}
                            className={`${inputStyle} min-w-28 text-right tabular-nums`}
                            type="number"
                            min={0}
                            step="any"
                            value={draft.rate}
                            onChange={(e) => {
                              setDrafts((old) =>
                                old.map((d, i) =>
                                  i === index
                                    ? {
                                        ...d,
                                        rate: e.target.value,
                                        line: {
                                          ...d.line,
                                          rateSource: "manual",
                                        },
                                      }
                                    : d,
                                ),
                              );
                              setDirty(true);
                            }}
                          />
                        ) : (
                          formatUnitRate(line.rate, line.unit)
                        )}
                      </td>
                      <td className="p-2">
                        <span className="rounded-sm bg-stone-50 px-2 py-1 text-xs">
                          {t(`rateSources.${line.rateSource}`)}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {formatCurrency(line.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!valid && (
            <p role="alert" className="text-risk">
              {t("invalidCost")}
            </p>
          )}
          {editable && (
            <span title={!valid ? t("invalidCost") : undefined}>
              <Button
                disabled={!valid || saving || !dirty}
                onClick={() => void save()}
              >
                {t("save")}
              </Button>
            </span>
          )}
        </section>
      </div>
      <section className={panelStyle}>
        <LinkedRecords
          projectId={variation.projectId}
          type="variation"
          id={variation.id}
          comparisonId={variation.comparisonId}
        />
      </section>
      <EntityActivity
        projectId={variation.projectId}
        entities={[{ type: "variation", id: variation.id }]}
      />
      {focus && (
        <ComparisonDialog
          comparisonId={focus.comparisonId}
          changeId={focus.changeId}
          onOpenChange={(open) => {
            if (!open) setFocus(undefined);
          }}
        />
      )}
    </div>
  );
}
