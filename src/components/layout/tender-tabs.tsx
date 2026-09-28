"use client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const items = [
  ["risk", "risk"],
  ["scope", "scope"],
  ["rates", "rates"],
  ["boq", "boq"],
] as const;
export function TenderTabs({ projectId }: { projectId: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("risk")}
      className="mb-6 flex gap-4 border-b border-line"
    >
      {items.map(([path, key]) => {
        const href = `/projects/${projectId}/tender/${path}`;
        const active = pathname.endsWith(href);
        return (
          <Link
            key={path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 border-transparent px-2 py-2 text-sm font-medium text-muted-ink hover:text-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600",
              active && "border-clay-700 text-ink",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
