"use client";
import { useRef, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  EmptyState,
} from "@/components/ui";
export function DetailDrawer() {
  const t = useTranslations("Migration");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const detail = params.get("detail");
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (detail) return;
    const remember = () => {
      trigger.current = document.activeElement as HTMLElement;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, [detail]);
  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("detail");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }
  return (
    <Drawer
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DrawerContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
          trigger.current = null;
        }}
      >
        <div className="p-5">
          <DrawerTitle>{t("detail")}</DrawerTitle>
          <DrawerDescription>{t("coming")}</DrawerDescription>
          <EmptyState message={t("coming")} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
