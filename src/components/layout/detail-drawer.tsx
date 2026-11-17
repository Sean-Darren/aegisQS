"use client";
import { useRef, useEffect, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { useProjectDocuments } from "@/lib/api/use-records";
import { useParams } from "next/navigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Drawer, DrawerContent, DrawerTitle } from "@/components/ui";
const DocumentDetail = dynamic(
  () => import("@/features/documents").then((m) => m.DocumentDetail),
  { ssr: false },
);
const RecordDetail = dynamic(
  () =>
    import("@/components/records/record-detail").then((m) => m.RecordDetail),
  { ssr: false },
);
const CheckDetail = dynamic(
  () => import("@/features/workbooks").then((m) => m.CheckDetail),
  { ssr: false },
);
export function DetailDrawer() {
  const t = useTranslations("Records");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const detail = params.get("detail");
  const route = useParams<{ projectId?: string }>();
  const records = useProjectDocuments(
    detail?.startsWith("document_version:") ? (route.projectId ?? "") : "",
  );
  const [type, ...parts] = (detail ?? "").split(":");
  const id = parts.join(":");
  const version = records.allVersions.find((v) => v.id === id);
  const documentId = type === "document" ? id : version?.documentId;
  const trigger = useRef<HTMLElement | null>(null);
  const drawer = useRef<HTMLDivElement>(null);
  // Breadcrumb stack of previously viewed records inside the drawer, so the
  // Back button can return from a linked record to the record it came from.
  const [history, setHistory] = useState<string[]>([]);
  const previousDetail = useRef<string | null>(null);
  const goingBack = useRef(false);
  useEffect(() => {
    if (previousDetail.current && detail && previousDetail.current !== detail) {
      // A back navigation replaces the current entry; do not push it again.
      if (goingBack.current) goingBack.current = false;
      else setHistory((list) => [...list, previousDetail.current!]);
    }
    if (!detail) setHistory([]);
    previousDetail.current = detail;
  }, [detail]);
  const back = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((list) => list.slice(0, -1));
    goingBack.current = true;
    const next = new URLSearchParams(params.toString());
    next.set("detail", last);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("detail");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }, [params, pathname, router]);
  useEffect(() => {
    if (!detail) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const dialogs = document.querySelectorAll(
        '[role="dialog"][data-state="open"]',
      );
      if (dialogs[dialogs.length - 1] !== drawer.current) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [detail, close]);
  return (
    <Drawer
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DrawerContent
        ref={drawer}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Restore focus without scrolling: refocusing a row that sits
          // below the fold would yank the page down on close.
          trigger.current?.focus({ preventScroll: true });
          trigger.current = null;
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* The visible heading was removed; the accessible name stays for
              screen readers. */}
          <DrawerTitle className="sr-only">{t("detail")}</DrawerTitle>
          {history.length > 0 && (
            <Button variant="ghost" className="-ml-2 mb-2" onClick={back}>
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              {t("back")}
            </Button>
          )}
          {type === "check" ? (
            <CheckDetail versionId={params.get("version") ?? ""} id={id} />
          ) : documentId ? (
            <DocumentDetail
              key={detail}
              documentId={documentId}
              versionId={type === "document_version" ? id : undefined}
            />
          ) : (
            <RecordDetail
              key={detail}
              type={type}
              id={id}
              projectId={route.projectId ?? ""}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
