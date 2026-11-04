"use client";
import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useProjectDocuments } from "@/lib/api/use-records";
import { useParams } from "next/navigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui";
const DocumentDetail = dynamic(
  () => import("@/features/documents").then((m) => m.DocumentDetail),
  { ssr: false },
);
const RecordDetail = dynamic(
  () =>
    import("@/components/records/record-detail").then((m) => m.RecordDetail),
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
          <DrawerDescription>{t("description")}</DrawerDescription>
          {documentId ? (
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
