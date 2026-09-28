"use client";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { queryKeys, resources } from "@/lib/api";
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
          focusBeforeOpen.current?.focus();
          focusBeforeOpen.current = null;
        }}
      >
        <div className="border-b border-line p-6 pr-12">
          <DrawerTitle className="text-xl font-semibold">
            {t("title")}
          </DrawerTitle>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {flag.isPending && (
            <>
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </>
          )}
          {flag.isError && (
            <ErrorState
              message={t("error")}
              action={{
                label: common("retry"),
                onClick: () => void flag.refetch(),
              }}
            />
          )}
          {flag.data && (
            <>
              <div>
                <h2 className="text-lg font-semibold">{flag.data.title}</h2>
                <p className="mt-2 text-muted-ink">{flag.data.description}</p>
              </div>
              {flag.data.evidence.length === 0 ? (
                <ErrorState message={t("missing")} />
              ) : (
                flag.data.evidence.map((evidence) => (
                  <section
                    key={evidence.id}
                    className="rounded-lg border border-line bg-surface p-4"
                  >
                    <h3 className="font-semibold">{t("source")}</h3>
                    <p className="mt-2 text-sm text-muted-ink">
                      {t("document", { id: evidence.documentId })}
                      {evidence.page
                        ? ` · ${t("page", { page: evidence.page })}`
                        : ""}
                    </p>
                    <p className="mt-4 text-sm font-medium">{t("excerpt")}</p>
                    <blockquote className="mt-1 border-l-2 border-clay-600 pl-3 text-sm">
                      {evidence.excerpt}
                    </blockquote>
                    {evidence.calculation && (
                      <div className="mt-4">
                        <p className="text-sm font-medium">
                          {t("calculation")}
                        </p>
                        <p className="num text-right text-sm">
                          {evidence.calculation.expression} ={" "}
                          {evidence.calculation.result}
                        </p>
                      </div>
                    )}
                    <a
                      className="mt-4 inline-block rounded-sm text-sm font-semibold text-clay-800 underline focus-visible:outline-2 focus-visible:outline-clay-600"
                      target="_blank"
                      rel="noreferrer"
                      href={`/api/v1/documents/${encodeURIComponent(evidence.documentId)}/file`}
                    >
                      {t("openDocument")}
                    </a>
                  </section>
                ))
              )}
              <p className="num text-right text-sm text-muted-ink">
                {t("confidence")}: {(flag.data.confidence * 100).toFixed(1)}%
              </p>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
