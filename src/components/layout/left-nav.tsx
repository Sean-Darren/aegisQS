"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Files,
  DraftingCompass,
  GitCompareArrows,
  Table2,
  CalendarRange,
  History,
  Layers,
  FolderOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
const items: readonly [string, LucideIcon][] = [
  ["overview", LayoutDashboard],
  ["documents", Files],
  ["drawings", DraftingCompass],
  ["variations", GitCompareArrows],
  ["workbooks", Table2],
  ["procurement", CalendarRange],
];
export function LeftNav({
  projectId,
  showAdmin,
}: {
  projectId?: string;
  showAdmin: boolean;
}) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const comparing = pathname.includes("/drawings/compare/");
  const pid = projectId || "";
  const links: [string, string, LucideIcon, boolean][] = [
    ["/projects", "projects", FolderOpen, true],
    ...items.map(
      ([key, icon]) =>
        [`/projects/${pid}/${key}`, key, icon, !!projectId] as [
          string,
          string,
          LucideIcon,
          boolean,
        ],
    ),
    ["/materials", "materials", Layers, true],
    [`/projects/${pid}/audit`, "audit", History, !!projectId],
    ...(
      showAdmin
        ? [["/admin", "admin", Settings, true] as [string, string, LucideIcon, boolean]]
        : []
    ),
  ];
  return (
    <nav
      aria-label={t("projects")}
      data-collapsed={comparing}
      className="app-sidebar flex shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-2 py-5 text-sidebar-foreground"
    >
      {links.map(([href, label, Icon, enabled]) => {
        const selected =
          pathname.endsWith(href) ||
          (label !== "projects" && pathname.includes(`${href}/`));
        return (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                  label === "materials" &&
                    "mt-3 border-t border-sidebar-border pt-4",
                  selected
                    ? "bg-sidebar-accent font-semibold before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:bg-lichen"
                    : enabled
                      ? "hover:bg-sidebar-accent"
                      : "pointer-events-none opacity-40",
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="shrink-0"
                />
                <span className="sidebar-label">{t(label)}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{t(label)}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
