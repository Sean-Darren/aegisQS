"use client";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import type { WorkbookCheck } from "@/schemas";
export function IssueMarker({
  check,
  onOpen,
}: {
  check: WorkbookCheck;
  onOpen: () => void;
}) {
  const t = useTranslations("StatusVocabulary.checkSeverity");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={`${t(check.severity)}: ${check.sheet}!${check.cell} — ${check.message}`}
          data-severity={check.severity}
          className="absolute right-0 top-0 size-4 focus-visible:outline-2 focus-visible:outline-clay-600"
        >
          <span
            aria-hidden="true"
            className={`absolute right-0 top-0 size-0 border-l-[7px] border-l-transparent border-t-[7px] ${check.severity === "error" ? "border-t-risk" : check.severity === "warning" ? "border-t-caution" : "border-t-muted-ink"}`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{check.message}</TooltipContent>
    </Tooltip>
  );
}
