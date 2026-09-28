"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const items = [
  ["overview", "overview"],
  ["documents", "documents"],
  ["pre-tender/scope-gaps", "scopeGaps"],
  ["tender/risk", "risk"],
  ["tender/scope", "scope"],
  ["tender/rates", "rates"],
  ["tender/boq", "boq"],
  ["flags", "flags"],
  ["reports", "reports"],
  ["audit", "audit"],
] as const;

export function LeftNav({
  projectId,
  showAdmin,
}: {
  projectId?: string;
  showAdmin: boolean;
}) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const links: Array<[string, string]> = [["/projects", "projects"]];
  if (projectId)
    links.push(
      ...items.map(
        ([path, label]) =>
          [`/projects/${projectId}/${path}`, label] as [string, string],
      ),
    );
  if (showAdmin) links.push(["/admin", "admin"]);
  return (
    <nav
      aria-label={t("projects")}
      className="flex min-w-48 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground"
    >
      {links.map(([href, label]) => {
        const selected = pathname.endsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
              selected
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
