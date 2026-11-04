"use client";
import { JobStatus } from "./job-status";
import type { ReactNode } from "react";
import { Bell, CircleDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/auth/permissions";
import { useMockRoleSwitcher } from "@/lib/auth/session";
import type { Project, Role, User } from "@/schemas";
import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";

const roles: Role[] = ["senior_qs", "qs", "viewer", "admin"];
export function Header({
  user,
  projects,
  projectId,
  primaryAction,
}: {
  user?: User;
  projects: Project[];
  projectId?: string;
  primaryAction?: ReactNode;
}) {
  const t = useTranslations("Shell");
  const router = useRouter();
  const switchRole = useMockRoleSwitcher();
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-4 border-b border-line bg-panel px-5 py-2.5">
      <Link
        href="/projects"
        className="shrink-0 rounded-sm text-lg font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
      >
        {t("product")}
      </Link>
      {can(user, "project.view") && (
        <label className="flex items-center gap-2 text-xs text-muted-ink">
          <span>{t("project")}</span>
          <select
            aria-label={t("selectProject")}
            value={projectId ?? ""}
            onChange={(event) => {
              const selected = projects.find(
                (item) => item.id === event.target.value,
              );
              if (!selected) return;
              router.push(`/projects/${selected.id}/overview`);
            }}
            className="h-9 max-w-56 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
          >
            <option value="" disabled>
              {t("selectProject")}
            </option>
            {projects.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ml-auto flex items-center gap-2">
        {primaryAction}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1 text-xs text-muted-ink"
            >
              <CircleDashed size={16} strokeWidth={1.5} aria-hidden="true" />
              <JobStatus projectId={projectId} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("jobStatus")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <IconButton label={t("notifications")}>
                <Bell size={18} strokeWidth={1.5} />
              </IconButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("notificationsPlaceholder")}</TooltipContent>
        </Tooltip>
        {process.env.NEXT_PUBLIC_API_MOCKING === "enabled" && user && (
          <label className="flex items-center gap-2 text-xs text-muted-ink">
            <span>{t("role")}</span>
            <select
              aria-label={t("role")}
              value={user.role}
              onChange={async (event) => {
                await switchRole(event.target.value as Role);
              }}
              className="h-9 rounded-md border border-line-strong bg-panel px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {t(
                    role === "senior_qs"
                      ? "roleSenior"
                      : role === "qs"
                        ? "roleQs"
                        : role === "viewer"
                          ? "roleViewer"
                          : "roleAdmin",
                  )}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
  );
}
