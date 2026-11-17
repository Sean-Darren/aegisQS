"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApiError, queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
  LowConfidenceNote,
  useToast,
} from "@/components/ui";
import { recordHref } from "@/components/records/linked-records";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRange,
  formatSignedCurrency,
  actorLabelKey,
  type FormatLocale,
} from "@/lib/format";
import type { ProjectMaterialNeed } from "@/schemas";
import { useProcurement } from "../hooks/queries";
import { adviceWindow, exposureRows, newestAdvice } from "../model";
import { PurchasePlanner } from "./purchase-planner";
import { AdviceCard } from "./advice-card";
const ExposureChart = dynamic(
  () => import("./exposure-chart").then((m) => m.ExposureChart),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full" /> },
);
const th =
  "border-b border-line px-3 py-2 text-left text-xs font-semibold text-muted-ink";
const td = "border-b border-line px-3 py-3 text-sm";
const link =
  "rounded-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-clay-600";
export function ProcurementPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Procurement");
  const shell = useTranslations("Shell");
  const actorName = (value: string) => {
    const key = actorLabelKey(value);
    return key ? shell(key) : value;
  };
  const locale = useLocale() as FormatLocale;
  const session = useSession();
  const toast = useToast();
  const materials = useQuery({
    queryKey: queryKeys.materials(),
    queryFn: () => resources.materials(),
  });
  const { needs, advice } = useProcurement(projectId);
  const [plannerNeed, setPlannerNeed] = useState<ProjectMaterialNeed>();
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const artifacts = useQuery({
    queryKey: queryKeys.documents(projectId, { category: "site_record" }),
    queryFn: async () => {
      const docs = await resources.documents(projectId, {
        category: "site_record",
      });
      return docs.filter((doc) => doc.docNumber.startsWith("BIM-"));
    },
  });
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState(params.get("advice") ?? "");
  const extractMaterials = useMutation({
    mutationFn: (documentId: string) =>
      resources.extractMaterialNeeds(projectId, documentId),
    onSuccess: (result) => {
      void needs.refetch();
      void materials.refetch();
      toast(t("extracted", { count: result.length }), "success");
    },
    onError: (error) =>
      toast(
        error instanceof ApiError ? error.message : t("extractError"),
        "error",
      ),
  });
  const selected =
    advice.data?.find((a) => a.id === selectedId) ?? advice.data?.[0];
  const selectedMaterial = materials.data?.find(
    (m) => m.id === selected?.materialId,
  );
  const forecast = useQuery({
    queryKey: queryKeys.forecast(selected?.materialId ?? ""),
    queryFn: () => resources.forecast(selected!.materialId),
    enabled: !!selected,
  });
  const boq = useQuery({
    queryKey: queryKeys.boqItems(projectId),
    queryFn: () => resources.boqItems(projectId),
  });
  const variations = useQuery({
    queryKey: queryKeys.variations(projectId),
    queryFn: () => resources.variations(projectId),
  });
  if (materials.isPending || needs.isPending || advice.isPending)
    return <Skeleton className="h-96 w-full" />;
  if (materials.isError || needs.isError || advice.isError)
    return (
      <ErrorState
        message={t("loadError")}
        action={{
          label: t("retry"),
          onClick: () => {
            void materials.refetch();
            void needs.refetch();
            void advice.refetch();
          },
        }}
      />
    );
  const rows = exposureRows(needs.data, materials.data);
  const planningMaterial = materials.data.find(
    (m) => m.id === plannerNeed?.materialId,
  );
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-ink">{t("intro")}</p>
        {can(session.data, "procurement.plan") && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-full max-w-md">
              <label
                htmlFor="saved-artifact"
                className="mb-1 block text-sm font-medium"
              >
                {t("artifact")}
              </label>
              <Select
                value={selectedArtifactId}
                onValueChange={setSelectedArtifactId}
                disabled={artifacts.isPending}
              >
                <SelectTrigger id="saved-artifact" className="w-full">
                  <SelectValue
                    placeholder={
                      artifacts.isPending
                        ? t("loadingArtifacts")
                        : t("chooseArtifact")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(artifacts.data ?? []).map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.docNumber} · {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (selectedArtifactId)
                  extractMaterials.mutate(selectedArtifactId);
              }}
              disabled={!selectedArtifactId || extractMaterials.isPending}
              variant="secondary"
            >
              {extractMaterials.isPending
                ? t("extracting")
                : t("extractMaterials")}
            </Button>
          </div>
        )}
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("needs")}</h2>
        {needs.data.length === 0 ? (
          <div className="space-y-2">
            <EmptyState message={t("emptyNeeds")} />
            <Link className={link} href={`/projects/${projectId}/variations`}>
              {t("viewVariations")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full">
              <caption className="sr-only">{t("needs")}</caption>
              <thead>
                <tr>
                  {[
                    "material",
                    "quantityHeading",
                    "neededBy",
                    "source",
                    "exposureRange",
                    "trend",
                    "latestAdvice",
                    "actions",
                  ].map((k) => (
                    <th
                      key={k}
                      scope="col"
                      className={`${th} ${["quantityHeading", "exposureRange"].includes(k) ? "text-right" : ""}`}
                    >
                      {t(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {needs.data.map((need, i) => {
                  const material = materials.data.find(
                    (m) => m.id === need.materialId,
                  );
                  const latest = newestAdvice(advice.data, need.materialId);
                  return (
                    <tr key={`${need.materialId}:${need.source}:${i}`}>
                      <th
                        scope="row"
                        className={`${td} text-left font-semibold`}
                      >
                        <Link
                          className={link}
                          href={`/materials/${need.materialId}`}
                        >
                          {material?.name ?? need.materialId}
                        </Link>
                      </th>
                      <td className={`${td} text-right tabular-nums`}>
                        {formatNumber(need.quantity, locale)} {material?.unit}
                      </td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>
                        {need.neededBy
                          ? formatDate(need.neededBy, locale)
                          : t("notSet")}
                      </td>
                      <td className={td}>
                        <ul className="flex flex-wrap gap-2">
                          {need.sourceRefs.length ? (
                            need.sourceRefs.map((ref) => {
                              const entity =
                                need.source === "variation"
                                  ? variations.data?.find((v) => v.ref === ref)
                                      ?.id
                                  : need.source === "boq"
                                    ? boq.data?.find((b) => b.itemRef === ref)
                                        ?.id
                                    : need.source === "site_record"
                                      ? ref
                                      : undefined;
                              return (
                                <li
                                  key={ref}
                                  className="rounded-sm border border-line px-2 py-1"
                                >
                                  {entity ? (
                                    <Link
                                      className={link}
                                      href={recordHref(
                                        projectId,
                                        need.source === "variation"
                                          ? "variation"
                                          : need.source === "boq"
                                            ? "boq_item"
                                            : "document",
                                        entity,
                                      )}
                                    >
                                      {need.source === "site_record"
                                        ? `${t("sources.site_record")} · ${artifacts.data?.find((d) => d.id === ref)?.docNumber ?? ref}`
                                        : `${t(`sources.${need.source}`)} · ${ref}`}
                                    </Link>
                                  ) : (
                                    <span>
                                      {need.source === "site_record"
                                        ? `${t("sources.site_record")} · ${artifacts.data?.find((d) => d.id === ref)?.docNumber ?? ref}`
                                        : `${t(`sources.${need.source}`)} · ${ref}`}
                                    </span>
                                  )}
                                </li>
                              );
                            })
                          ) : (
                            <li>{t(`sources.${need.source}`)}</li>
                          )}
                        </ul>
                      </td>
                      <td
                        className={`${td} whitespace-nowrap text-right tabular-nums`}
                      >
                        {formatRange(
                          need.exposureHKD.p10,
                          need.exposureHKD.p90,
                        )}
                      </td>
                      <td className={td}>
                        {material && (
                          <StatusChip
                            domain="priceTrend"
                            value={material.trend}
                          />
                        )}
                      </td>
                      <td className={td}>
                        {latest ? (
                          <div className="space-y-1">
                            <LowConfidenceNote
                              kind="forecast"
                              confidence={latest.confidence}
                            />
                            <button
                              className={link}
                              onClick={() => setSelectedId(latest.id)}
                            >
                              <StatusChip
                                domain="advice"
                                value={latest.recommendation}
                              />
                            </button>
                          </div>
                        ) : (
                          t("noAdvice")
                        )}
                      </td>
                      <td className={td}>
                        {material && can(session.data, "procurement.plan") && (
                          <Button
                            variant="secondary"
                            onClick={() => setPlannerNeed(need)}
                            disabled={need.quantity <= 0}
                          >
                            {t("getAdvice")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(boq.isError || variations.isError) && (
          <ErrorState
            message={t("sourceError")}
            action={{
              label: t("retry"),
              onClick: () => {
                void boq.refetch();
                void variations.refetch();
              },
            }}
          />
        )}
      </section>
      {rows.length > 0 && (
        <section className="space-y-3 rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">{t("exposure")}</h2>
          <p className="text-sm text-muted-ink">{t("exposureBasis")}</p>
          <ExposureChart rows={rows} />
          <details>
            <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-clay-600">
              {t("exposureTable")}
            </summary>
            <table className="mt-3 w-full">
              <caption className="sr-only">{t("exposureTable")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {t("material")}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {t("exposureMedian")}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {t("exposureRange")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.material.id}>
                    <th scope="row" className={`${td} text-left`}>
                      {r.material.name}
                    </th>
                    <td className={`${td} text-right tabular-nums`}>
                      {formatCurrency(r.p50)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {formatRange(r.p10, r.p90)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("savedAdvice")}</h2>
        {advice.data.length === 0 ? (
          <EmptyState message={t("emptyAdvice")} />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
            {[...advice.data]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="space-y-1">
                    <button
                      className={`${link} font-semibold`}
                      aria-pressed={a.id === selected?.id}
                      onClick={() => setSelectedId(a.id)}
                    >
                      {materials.data.find((m) => m.id === a.materialId)
                        ?.name ?? a.materialId}{" "}
                      · {a.id}
                    </button>
                    <LowConfidenceNote
                      kind="forecast"
                      confidence={a.confidence}
                    />
                    <p>
                      <StatusChip domain="advice" value={a.recommendation} />{" "}
                      <span className="tabular-nums">
                        {adviceWindow(a, locale)}
                      </span>
                    </p>
                    <p className="text-sm tabular-nums">
                      {t("saving")}:{" "}
                      {a.expectedSaving === undefined
                        ? t("noSaving")
                        : formatSignedCurrency(a.expectedSaving)}{" "}
                      ·{" "}
                      {t("likelyRange", {
                        range: formatRange(a.range.low, a.range.high),
                      })}
                    </p>
                    <p className="text-xs text-muted-ink tabular-nums">
                      {t("createdBy", {
                        actor: actorName(a.createdBy),
                        date: formatDate(a.createdAt, locale),
                      })}
                    </p>
                  </div>
                  <Link
                    className={link}
                    href={`/materials/${a.materialId}?project=${encodeURIComponent(projectId)}&advice=${encodeURIComponent(a.id)}`}
                  >
                    {t("viewForecast")}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
      {selected && selectedMaterial && (
        <section className="space-y-3">
          {forecast.isPending && <Skeleton className="h-12 w-full" />}
          {forecast.isError && (
            <ErrorState
              message={t("modelError")}
              action={{
                label: t("retry"),
                onClick: () => {
                  void forecast.refetch();
                },
              }}
            />
          )}
          <AdviceCard
            advice={selected}
            material={selectedMaterial}
            forecast={forecast.data}
          />
          <Link
            className={link}
            href={`/materials/${selected.materialId}?project=${encodeURIComponent(projectId)}&advice=${encodeURIComponent(selected.id)}`}
          >
            {t("viewOverlay")}
          </Link>
        </section>
      )}
      {planningMaterial && (
        <PurchasePlanner
          open={!!plannerNeed}
          onOpenChange={(open) => {
            if (!open) setPlannerNeed(undefined);
          }}
          material={planningMaterial}
          projectId={projectId}
          need={plannerNeed}
          onSaved={(saved) => setSelectedId(saved.id)}
        />
      )}
    </div>
  );
}
