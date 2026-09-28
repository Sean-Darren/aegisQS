"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { formatDate, type FormatLocale } from "@/lib/format";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";

export default function ProjectsPage() {
  const t = useTranslations("Projects");
  const common = useTranslations("Common");
  const stages = useTranslations("Shell");
  const locale = useLocale() as FormatLocale;
  const session = useSession();
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
    enabled: can(session.data, "project.view"),
  });
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-ink">{t("description")}</p>
      </div>
      {projects.isPending && can(session.data, "project.view") && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      )}
      {projects.isError && (
        <ErrorState
          message={t("error")}
          action={{
            label: common("retry"),
            onClick: () => void projects.refetch(),
          }}
        />
      )}
      {projects.data?.length === 0 && <EmptyState message={t("empty")} />}
      {projects.data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <article
              key={project.id}
              className="rounded-lg border border-line bg-panel p-5 transition-shadow hover:shadow-sm motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-md bg-limewash text-clay-800">
                  <FolderOpen size={18} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="num text-xs text-muted-ink">
                  {project.code}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{project.name}</h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-ink">
                <span className="rounded-full bg-stone-50 px-2 py-1">
                  {stages(
                    project.stage === "pre_tender"
                      ? "stagePreTender"
                      : project.stage === "tender"
                        ? "stageTender"
                        : "stagePostAward",
                  )}
                </span>
                <span className="num rounded-full bg-stone-50 px-2 py-1">
                  {t("count", { count: project.tendererCount })}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-2 border-t border-line pt-4">
                <span className="text-xs text-muted-ink">
                  {t("created", {
                    date: formatDate(project.createdAt, locale),
                  })}
                </span>
                <Link
                  href={`/projects/${project.id}/overview`}
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-clay-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                >
                  {t("open")}
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
