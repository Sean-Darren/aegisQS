"use client";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";

/**
 * Compact overview KPI tile: a big number with a short label. The whole
 * card navigates like a button; the longer context lives in a hover/focus
 * tooltip so the tile itself stays uncluttered.
 */
export function KpiCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  href: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className="group block rounded-lg border border-line bg-panel p-5 text-left transition-colors hover:border-clay-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
          >
            <h2 className="text-sm text-muted-ink">{label}</h2>
            <div className="mt-3 text-4xl font-bold tabular-nums transition-colors group-hover:text-clay-700">
              {value}
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line">{detail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
