"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { queryKeys, resources } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { latestOrderDate } from "@/lib/procurement/latest-order-date";
import { formatDate, type FormatLocale } from "@/lib/format";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import type {
  Material,
  ProcurementAdvice,
  ProjectMaterialNeed,
} from "@/schemas";
import { useProcurement } from "../hooks/queries";
import { newestAdvice } from "../model";
const fieldsSchema = z.object({
  quantity: z.number().positive(),
  neededBy: z.iso.date(),
  leadTimeWeeks: z.number().nonnegative(),
});
type Fields = z.infer<typeof fieldsSchema>;
export function PurchasePlanner({
  open,
  onOpenChange,
  material,
  projectId,
  need,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material;
  projectId?: string;
  need?: ProjectMaterialNeed;
  onSaved: (advice: ProcurementAdvice) => void;
}) {
  const session = useSession();
  if (!can(session.data, "procurement.plan")) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PlannerContent
          material={material}
          projectId={projectId}
          need={need}
          onSaved={(a) => {
            onSaved(a);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
function PlannerContent({
  material,
  projectId,
  need,
  onSaved,
}: {
  material: Material;
  projectId?: string;
  need?: ProjectMaterialNeed;
  onSaved: (advice: ProcurementAdvice) => void;
}) {
  const t = useTranslations("Procurement");
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
  });
  const [chosen, setChosen] = useState(projectId ?? "");
  const returnFocus = useRef<HTMLElement | null>(null);
  const project = chosen || projects.data?.[0]?.id || "";
  const { needs, advice } = useProcurement(project);
  return (
    <DialogContent
      className="max-h-[90vh] overflow-y-auto space-y-4"
      onOpenAutoFocus={() => {
        returnFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus.current?.focus();
      }}
    >
      <DialogTitle className="pr-7 text-xl font-semibold">
        {t("plan")}
      </DialogTitle>
      <DialogDescription>
        {t("plannerDescription", {
          material: material.name,
          unit: material.unit,
        })}
      </DialogDescription>
      <label className="block">
        {t("project")}
        <select
          className={inputStyle}
          value={project}
          onChange={(e) => setChosen(e.target.value)}
          disabled={projects.isPending}
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
      {(projects.isPending ||
        (project && (needs.isPending || advice.isPending))) && (
        <Skeleton className="h-48 w-full" />
      )}
      {(projects.isError || needs.isError || advice.isError) && (
        <ErrorState
          message={t("loadError")}
          action={{
            label: t("retry"),
            onClick: () => {
              void projects.refetch();
              if (project) {
                void needs.refetch();
                void advice.refetch();
              }
            },
          }}
        />
      )}
      {projects.data?.length === 0 && <EmptyState message={t("noProjects")} />}
      {project && needs.data && advice.data && (
        <PlannerForm
          key={project}
          projectId={project}
          material={material}
          need={
            need?.projectId === project
              ? need
              : needs.data.find((n) => n.materialId === material.id)
          }
          previous={newestAdvice(advice.data, material.id)}
          onSaved={onSaved}
        />
      )}
    </DialogContent>
  );
}
function PlannerForm({
  projectId,
  material,
  need,
  previous,
  onSaved,
}: {
  projectId: string;
  material: Material;
  need?: ProjectMaterialNeed;
  previous?: ProcurementAdvice;
  onSaved: (advice: ProcurementAdvice) => void;
}) {
  const t = useTranslations("Procurement");
  const locale = useLocale() as FormatLocale;
  const cache = useQueryClient();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Fields>({
    resolver: zodResolver(fieldsSchema),
    defaultValues: {
      quantity:
        need?.quantity && need.quantity > 0
          ? need.quantity
          : previous?.quantity,
      neededBy: (need?.neededBy ?? previous?.neededBy ?? "").slice(0, 10),
      leadTimeWeeks: previous?.leadTimeWeeks,
    },
  });
  const date = useWatch({ control, name: "neededBy" });
  const weeks = useWatch({ control, name: "leadTimeWeeks" });
  let latest: string | undefined;
  try {
    if (
      fieldsSchema.shape.neededBy.safeParse(date).success &&
      typeof weeks === "number"
    )
      latest = latestOrderDate(date, weeks);
  } catch {
    /* Invalid input is explained below its field. */
  }
  const mutation = useMutation({
    mutationFn: (values: Fields) =>
      resources.createProcurement(projectId, {
        ...values,
        materialId: material.id,
        neededBy: `${values.neededBy}T00:00:00Z`,
      }),
    onSuccess: async (saved) => {
      cache.setQueryData<ProcurementAdvice[]>(
        queryKeys.procurement(projectId),
        (old) => [...(old ?? []).filter((a) => a.id !== saved.id), saved],
      );
      await Promise.all([
        cache.invalidateQueries({
          queryKey: queryKeys.auditEvents(projectId).slice(0, 3),
        }),
        cache.invalidateQueries({ queryKey: queryKeys.overview(projectId) }),
      ]);
      toast(t("saved"), "success");
      onSaved(saved);
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <label className="block">
          {t("quantity", { unit: material.unit })}
          <input
            className={`${inputStyle} tabular-nums`}
            type="number"
            step="any"
            min="0"
            required
            aria-invalid={!!errors.quantity}
            aria-describedby={errors.quantity ? "quantity-error" : undefined}
            {...register("quantity", { valueAsNumber: true })}
          />
        </label>
        {errors.quantity && (
          <p id="quantity-error" role="alert" className="text-sm text-risk">
            {t("quantityError")}
          </p>
        )}
        <label className="block">
          {t("neededBy")}
          <input
            className={`${inputStyle} tabular-nums`}
            type="date"
            required
            aria-invalid={!!errors.neededBy}
            {...register("neededBy")}
          />
        </label>
        {errors.neededBy && (
          <p role="alert" className="text-sm text-risk">
            {t("dateError")}
          </p>
        )}
        <label className="block">
          {t("leadTime")}
          <input
            className={`${inputStyle} tabular-nums`}
            type="number"
            min="0"
            step="any"
            required
            aria-invalid={!!errors.leadTimeWeeks}
            {...register("leadTimeWeeks", { valueAsNumber: true })}
          />
        </label>
        {errors.leadTimeWeeks && (
          <p role="alert" className="text-sm text-risk">
            {t("leadError")}
          </p>
        )}
      </fieldset>
      <p aria-live="polite" className="text-sm tabular-nums">
        {t("liveLatest", {
          date: latest ? formatDate(latest, locale) : t("enterDates"),
        })}
      </p>
      {mutation.isError && <ErrorState message={t("submitError")} />}
      <Button type="submit" disabled={mutation.isPending}>
        {t(mutation.isPending ? "calculating" : "getAdvice")}
      </Button>
    </form>
  );
}
