"use client";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { statusVocabulary, type StatusDomain } from "@/lib/config/status";
import { cn } from "@/lib/utils";
const tones = {
  added: "text-rev-target bg-rev-target-bg",
  removed: "text-rev-base bg-risk-bg",
  caution: "text-caution bg-caution-bg",
  muted: "text-muted-ink bg-stone-50",
  tolerance: "text-tolerance bg-tolerance-bg",
  ink: "text-primary-foreground bg-ink",
  risk: "text-risk bg-risk-bg",
  clay: "text-primary-foreground bg-clay-700",
};
type Props = {
  [D in StatusDomain]: {
    domain: D;
    value: keyof (typeof statusVocabulary)[D];
    compact?: boolean;
    className?: string;
  };
}[StatusDomain];
export function StatusChip({
  domain,
  value,
  compact = false,
  className,
}: Props) {
  const t = useTranslations("StatusVocabulary");
  const entry = (
    statusVocabulary[domain] as Record<
      string,
      { icon: LucideIcon; tone: keyof typeof tones; labelKey: string }
    >
  )[value];
  const Icon = entry.icon;
  return (
    <span
      data-slot="status-chip"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 px-2 text-xs font-medium",
        compact ? "h-5 rounded-sm" : "h-6 rounded-full",
        tones[entry.tone],
        className,
      )}
    >
      <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
      {t(entry.labelKey)}
    </span>
  );
}
