"use client";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { queryKeys, resources } from "@/lib/api";
import { FlagEvidenceContent } from "@/features/evidence";
import {
  ErrorState,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Skeleton,
} from "@/components/ui";

export function EvidenceDrawer() {
  const t = useTranslations("Evidence");
  const common = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const flagId = params.get("evidence");
  const focusBeforeOpen = useRef<HTMLElement | null>(null);
  const flag = useQuery({
    queryKey: queryKeys.flag(flagId ?? ""),
    queryFn: () => resources.flag(flagId!),
    enabled: !!flagId,
  });
  useEffect(() => {
    if (flagId && !focusBeforeOpen.current)
      focusBeforeOpen.current = document.activeElement as HTMLElement;
  }, [flagId]);
  useEffect(() => {
    if (!flagId) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const next = new URLSearchParams(window.location.search);
      next.delete("evidence");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
        scroll: false,
      });
    };
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [flagId, pathname, router]);
  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("evidence");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }
  return (
    <Drawer
      open={!!flagId}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DrawerContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (focusBeforeOpen.current?.isConnected) {
            focusBeforeOpen.current.focus();
          } else if (flagId) {
            document
              .querySelector<HTMLElement>(`[data-evidence-trigger="${flagId}"]`)
              ?.focus();
          }
          focusBeforeOpen.current = null;
        }}
      >
        <div className="border-b border-line p-5 pr-12">
          <DrawerTitle className="text-lg font-semibold">
            {t("title")}
          </DrawerTitle>
        </div>
        <div className="flex-1 overflow-y-auto">
          {flag.isPending && (
            <div className="space-y-4 p-5">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-[440px] w-full" />
            </div>
          )}
          {flag.isError && (
            <div className="p-5">
              <ErrorState
                message={t("error")}
                action={{
                  label: common("retry"),
                  onClick: () => void flag.refetch(),
                }}
              />
            </div>
          )}
          {flag.data && (
            <FlagEvidenceContent key={flag.data.id} flag={flag.data} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
