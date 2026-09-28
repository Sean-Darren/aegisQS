"use client";
import {
  CircleCheck,
  CircleDot,
  TriangleAlert,
  OctagonAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Severity, RiskBand } from "@/schemas";
import { cn } from "@/lib/utils";
const statusStyle = {
  low: "bg-tolerance-bg text-tolerance",
  medium: "bg-caution-bg text-caution",
  moderate: "bg-caution-bg text-caution",
  high: "bg-risk-bg text-risk",
  critical: "bg-risk text-primary-foreground",
} as const;
const icons = {
  low: CircleCheck,
  medium: CircleDot,
  moderate: CircleDot,
  high: TriangleAlert,
  critical: OctagonAlert,
};
function StatusBadge({
  level,
  label,
}: {
  level: keyof typeof statusStyle;
  label: string;
}) {
  const Icon = icons[level];
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        statusStyle[level],
      )}
    >
      <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useTranslations("Status");
  return <StatusBadge level={severity} label={t(`severity.${severity}`)} />;
}
export function RiskBandBadge({ band }: { band: RiskBand }) {
  const t = useTranslations("Status");
  return <StatusBadge level={band} label={t(`band.${band}`)} />;
}
