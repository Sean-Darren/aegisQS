"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProjectStage } from "@/schemas";
import { cn } from "@/lib/utils";

const stages = [
  { key: "pre_tender", label: "stagePreTender", path: "pre-tender/scope-gaps" },
  { key: "tender", label: "stageTender", path: "tender/risk" },
  { key: "post_award", label: "stagePostAward", path: "reports" },
] as const;

export function StageStepper({
  projectId,
  stage,
}: {
  projectId: string;
  stage: ProjectStage;
}) {
  const t = useTranslations("Shell");
  return (
    <nav
      aria-label={t("project")}
      className="hidden items-center gap-1 lg:flex"
    >
      {stages.map((item, index) => (
        <div key={item.key} className="flex items-center gap-1">
          {index > 0 && (
            <span className="px-1 text-muted-ink" aria-hidden="true">
              →
            </span>
          )}
          <Link
            href={`/projects/${projectId}/${item.path}`}
            aria-current={stage === item.key ? "step" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600",
              stage === item.key
                ? "bg-limewash text-clay-800 font-semibold"
                : "text-muted-ink hover:bg-stone-50 hover:text-ink",
            )}
          >
            {t(item.label)}
          </Link>
        </div>
      ))}
    </nav>
  );
}
