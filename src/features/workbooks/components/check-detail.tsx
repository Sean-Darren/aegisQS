"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { resources, queryKeys } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  Button,
  DecisionForm,
  StatusChip,
  ErrorState,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import type { WorkbookCheck } from "@/schemas";
export function CheckActions({ check }: { check: WorkbookCheck }) {
  const t = useTranslations("Workbooks");
  const client = useQueryClient();
  const session = useSession();
  const [ignore, setIgnore] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  async function update(status: WorkbookCheck["status"], reason?: string) {
    setPending(true);
    setError(false);
    try {
      await resources.resolveCheck(check.id, { status, reason });
      await client.invalidateQueries({
        queryKey: queryKeys.checks(check.versionId),
      });
      await client.invalidateQueries({ queryKey: ["projects"] });
      setIgnore(false);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  if (!can(session.data, "workbook.resolveCheck")) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            void update(check.status === "open" ? "resolved" : "open")
          }
        >
          {t(check.status === "open" ? "resolve" : "reopen")}
        </Button>
        {check.status === "open" && (
          <Button variant="ghost" onClick={() => setIgnore((v) => !v)}>
            {t("ignore")}
          </Button>
        )}
      </div>
      {ignore && (
        <DecisionForm
          actions={[{ value: "ignored", label: t("ignore") }]}
          actionLabel={t("action")}
          reasonLabel={t("reason")}
          submitLabel={t("ignore")}
          errorMessage={t("reasonRequired")}
          minReasonLength={1}
          pending={pending}
          onSubmit={({ reason }) => update("ignored", reason)}
        />
      )}
      {error && <ErrorState message={t("error")} />}
    </div>
  );
}
export function CheckDetail({
  versionId,
  id,
}: {
  versionId: string;
  id: string;
}) {
  const t = useTranslations("Workbooks");
  const query = useQuery({
    queryKey: queryKeys.checks(versionId),
    queryFn: () => resources.checks(versionId),
    enabled: !!versionId,
  });
  if (!versionId) return <EmptyState message={t("openWorkbook")} />;
  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState message={t("error")} />;
  const c = query.data.find((c) => c.id === id);
  if (!c) return <EmptyState message={t("noChecks")} />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {c.sheet}!{c.cell}
      </h2>
      <StatusChip domain="checkSeverity" value={c.severity} />
      <p>{c.message}</p>
      <p>
        {c.expected} · {c.actual}
      </p>
      <p>{t(`statuses.${c.status}`)}</p>
      {c.resolution && (
        <p>
          {c.resolution.by} · {c.resolution.reason}
        </p>
      )}
      <CheckActions check={c} />
    </div>
  );
}
