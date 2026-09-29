"use client";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/auth/permissions";
import { formatDate, type FormatLocale } from "@/lib/format";
import {
  dispositionInputSchema,
  type DispositionInput,
  type Flag,
  type User,
} from "@/schemas";

export function DispositionPanel({
  flag,
  user,
  pending,
  error,
  onSubmit,
}: {
  flag: Flag;
  user?: User;
  pending: boolean;
  error: boolean;
  onSubmit: (
    kind: "proposal" | "decision",
    input: DispositionInput,
  ) => Promise<boolean>;
}) {
  const t = useTranslations("Evidence");
  const locale = useLocale() as FormatLocale;
  const canFinalize = can(user, "flag.finalize");
  const canPropose = can(user, "flag.propose");
  const kind = canFinalize ? "decision" : "proposal";
  const form = useForm<DispositionInput>({
    resolver: zodResolver(dispositionInputSchema),
    defaultValues: { action: flag.proposal?.action ?? "accept", reason: "" },
  });
  useEffect(() => {
    form.reset({ action: flag.proposal?.action ?? "accept", reason: "" });
  }, [flag.id, flag.proposal?.action, form]);
  return (
    <section
      aria-label={t("disposition")}
      className="border-t border-line bg-panel p-5"
    >
      <h3 className="text-base font-semibold">{t("disposition")}</h3>
      {flag.proposal && (
        <div className="mt-3 rounded-md border border-line bg-stone-50 p-3 text-sm">
          <p className="font-medium">
            {t("proposal")}: {t(`actions.${flag.proposal.action}`)}
          </p>
          <p className="mt-1 text-muted-ink">{flag.proposal.reason}</p>
          <p className="num mt-2 text-xs text-muted-ink">
            {t("byAt", {
              by: flag.proposal.by,
              date: formatDate(flag.proposal.at, locale),
            })}
          </p>
        </div>
      )}
      {flag.decision ? (
        <div className="mt-3 rounded-md border border-line bg-tolerance-bg p-3 text-sm">
          <p className="font-medium text-tolerance">
            {t("finalDecision")}: {t(`actions.${flag.decision.action}`)}
          </p>
          <p className="mt-1">{flag.decision.reason}</p>
          <p className="num mt-2 text-xs text-muted-ink">
            {t("byAt", {
              by: flag.decision.by,
              date: formatDate(flag.decision.at, locale),
            })}
          </p>
        </div>
      ) : canFinalize || canPropose ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            if (await onSubmit(kind, values))
              form.reset({ action: values.action, reason: "" });
          })}
        >
          <label className="block text-[13px] font-medium">
            {t("action")}
            <select
              {...form.register("action")}
              className="mt-1 h-9 w-full rounded-md border border-line-strong bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            >
              {(["accept", "dismiss", "escalate"] as const).map((action) => (
                <option key={action} value={action}>
                  {t(`actions.${action}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-medium">
            {t("reason")}
            <Textarea
              {...form.register("reason")}
              className="mt-1 min-h-20"
              aria-invalid={!!form.formState.errors.reason}
              aria-describedby="disposition-reason-hint"
            />
          </label>
          <p
            id="disposition-reason-hint"
            className={
              form.formState.errors.reason
                ? "text-xs text-risk"
                : "text-xs text-muted-ink"
            }
          >
            {t("reasonHint")}
          </p>
          {error && (
            <p role="alert" className="text-sm text-risk">
              {t("saveError")}
            </p>
          )}
          <Button
            variant={canFinalize ? "primary" : "secondary"}
            type="submit"
            disabled={pending}
          >
            {t(canFinalize ? "recordDecision" : "submitProposal")}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-ink">{t("readOnly")}</p>
      )}
    </section>
  );
}
