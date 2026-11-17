"use client";
import { useSyncExternalStore } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

type SidebarPref = "expanded" | "collapsed";
const SIDEBAR_PREF_KEY = "aegisqs.sidebar";
const sidebarListeners = new Set<() => void>();
function subscribeSidebar(notify: () => void) {
  sidebarListeners.add(notify);
  return () => sidebarListeners.delete(notify);
}
function readSidebarPref(): SidebarPref | null {
  const value = localStorage.getItem(SIDEBAR_PREF_KEY);
  return value === "expanded" || value === "collapsed" ? value : null;
}
function writeSidebarPref(pref: SidebarPref) {
  localStorage.setItem(SIDEBAR_PREF_KEY, pref);
  for (const notify of sidebarListeners) notify();
}

const wideScreen = {
  subscribe: (notify: () => void) => {
    const mq = window.matchMedia("(min-width: 1440px)");
    mq.addEventListener("change", notify);
    return () => mq.removeEventListener("change", notify);
  },
  getSnapshot: () => window.matchMedia("(min-width: 1440px)").matches,
};

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
  const manual = useSyncExternalStore(
    subscribeSidebar,
    readSidebarPref,
    () => null,
  );
  const isWide = useSyncExternalStore(
    wideScreen.subscribe,
    wideScreen.getSnapshot,
    () => false,
  );
  // Mirrors the CSS width rules: labels are visible (and tooltips therefore
  // redundant) whenever the sidebar is expanded — by preference or by the
  // wide-screen default. Tooltips stay available in icon-only mode.
  const expanded =
    manual === "expanded" || (manual === null && isWide && !comparing);
  const toggle = () => {
    const current: SidebarPref =
      manual === null
        ? window.matchMedia("(min-width: 1440px)").matches && !comparing
          ? "expanded"
          : "collapsed"
        : manual;
    writeSidebarPref(current === "expanded" ? "collapsed" : "expanded");
  };
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
    ...(showAdmin
      ? [
          ["/admin", "admin", Settings, true] as [
            string,
            string,
            LucideIcon,
            boolean,
          ],
        ]
      : []),
  ];
  return (
    <nav
      aria-label={t("projects")}
      data-collapsed={comparing}
      data-manual={manual ?? undefined}
      className="app-sidebar flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-2 py-5 text-sidebar-foreground"
    >
      {/* Scrollable link area; the collapse toggle below stays pinned to
          the bottom of the sidebar regardless of viewport height. */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {links.map(([href, label, Icon, enabled]) => {
          const selected =
            pathname.endsWith(href) ||
            (label !== "projects" && pathname.includes(`${href}/`));
          const link = (
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
          );
          return expanded ? (
            link
          ) : (
            <Tooltip key={label}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{t(label)}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {(() => {
        const toggleButton = (
          <button
            type="button"
            onClick={toggle}
            aria-label={t("toggleSidebar")}
            className="mt-2 flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
          >
            <PanelLeftClose
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
              className="toggle-collapse-icon shrink-0"
            />
            <PanelLeftOpen
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
              className="toggle-expand-icon shrink-0"
            />
          </button>
        );
        return expanded ? (
          toggleButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
            <TooltipContent side="right">{t("toggleSidebar")}</TooltipContent>
          </Tooltip>
        );
      })()}
    </nav>
  );
}
