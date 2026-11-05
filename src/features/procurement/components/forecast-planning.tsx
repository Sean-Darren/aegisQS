"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import type { Material, PriceForecast, ProcurementAdvice } from "@/schemas";
import { useProcurement } from "../hooks/queries";
import { newestAdvice } from "../model";
import { PurchasePlanner } from "./purchase-planner";
import { AdviceCard } from "./advice-card";
export function ForecastPlanning({
  material,
  forecast,
  onAdvice,
}: {
  material: Material;
  forecast: PriceForecast;
  onAdvice: (advice: ProcurementAdvice | undefined) => void;
}) {
  const t = useTranslations("Procurement");
  const session = useSession();
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
  });
  const params = useSearchParams();
  const [chosen, setChosen] = useState(params.get("project") ?? "");
  const [adviceId, setAdviceId] = useState(params.get("advice") ?? "");
  const [open, setOpen] = useState(false);
  const project = chosen || projects.data?.[0]?.id || "";
  const { needs, advice } = useProcurement(project);
  const list = (advice.data ?? []).filter((a) => a.materialId === material.id);
  const selected =
    list.find((a) => a.id === adviceId) ?? newestAdvice(list, material.id);
  useEffect(() => {
    onAdvice(selected);
  }, [selected, onAdvice]);
  return (
    <section className="space-y-3" aria-label={t("planning")}>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          {t("project")}
          <select
            className={inputStyle}
            value={project}
            onChange={(e) => {
              setChosen(e.target.value);
              setAdviceId("");
            }}
          >
            <option value="" disabled>
              {t("chooseProject")}
            </option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {list.length > 0 && (
          <label>
            {t("selectedAdvice")}
            <select
              className={inputStyle}
              value={selected?.id ?? ""}
              onChange={(e) => setAdviceId(e.target.value)}
            >
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {can(session.data, "procurement.plan") && (
          <Button onClick={() => setOpen(true)}>{t("plan")}</Button>
        )}
      </div>
      {(projects.isPending || (project && advice.isPending)) && (
        <Skeleton className="h-24 w-full" />
      )}
      {(projects.isError || advice.isError) && (
        <ErrorState
          message={t("loadError")}
          action={{
            label: t("retry"),
            onClick: () => {
              void projects.refetch();
              if (project) void advice.refetch();
            },
          }}
        />
      )}
      {selected && (
        <AdviceCard advice={selected} material={material} forecast={forecast} />
      )}
      <PurchasePlanner
        open={open}
        onOpenChange={setOpen}
        material={material}
        projectId={project}
        need={needs.data?.find((n) => n.materialId === material.id)}
        onSaved={(saved) => {
          setChosen(saved.projectId);
          setAdviceId(saved.id);
          onAdvice(saved);
        }}
      />
    </section>
  );
}
