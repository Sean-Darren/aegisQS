"use client";
import type { ReactNode } from "react";
import { CircleDashed, FileQuestion, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./button";
function State({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-panel p-5 text-sm text-ink">
      <span className="text-clay-600" aria-hidden="true">
        {icon}
      </span>
      <p>{message}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <State
      icon={<FileQuestion size={20} strokeWidth={1.5} />}
      message={message}
      action={action}
    />
  );
}
export function ErrorState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div role="alert">
      <State
        icon={<TriangleAlert size={20} strokeWidth={1.5} />}
        message={message}
        action={action}
      />
    </div>
  );
}
export function InsufficientDataState() {
  const t = useTranslations("Status");
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-stone-50 px-2 py-1 text-xs text-muted-ink">
      <CircleDashed size={14} strokeWidth={1.5} aria-hidden="true" />
      {t("insufficientData")}
    </span>
  );
}
