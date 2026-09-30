"use client";
import { CircleCheck, CircleHelp, TriangleAlert, Layers3 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ScopeStatus } from "../model";

const details = {
  mapped: { Icon: CircleCheck, className: "bg-tolerance-bg text-tolerance" },
  vague: { Icon: CircleHelp, className: "bg-caution-bg text-caution" },
  missing: { Icon: TriangleAlert, className: "bg-risk-bg text-risk" },
  oversized_ps: { Icon: Layers3, className: "bg-risk-bg text-risk" },
} as const;

export function ScopeStatusBadge({ status }: { status: ScopeStatus }) {
  const t = useTranslations("ScopeGaps.status");
  const { Icon, className } = details[status];
  return (
    <span
      data-slot="scope-status-badge"
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium ${className}`}
    >
      <Icon size={14} strokeWidth={1.7} aria-hidden="true" />
      {t(status)}
    </span>
  );
}
