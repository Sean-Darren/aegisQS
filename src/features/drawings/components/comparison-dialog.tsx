"use client";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { useComparison } from "../hooks/queries";
import { ComparisonWorkspace } from "./comparison-page";

/** Wide popup that hosts the full comparison experience: the run progress
    (queued → aligning → detecting) first, then the comparison workspace —
    so comparing revisions never leaves the current page. */
export function ComparisonDialog({
  comparisonId,
  changeId,
  onOpenChange,
}: {
  comparisonId: string;
  /** Optional change to preselect when the popup opens. */
  changeId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const common = useTranslations("Common");
  const t = useTranslations("Drawing");
  const query = useComparison(comparisonId);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[min(98vw,88rem)] flex-col p-4">
        <DialogTitle className="sr-only">{t("openComparison")}</DialogTitle>
        <div className="min-h-0 flex-1 overflow-hidden">
          {query.isPending ? (
            <Skeleton className="h-[600px] w-full" />
          ) : query.isError || !query.data ? (
            <ErrorState
              message={t("error")}
              action={{
                label: common("retry"),
                onClick: () => {
                  void query.refetch();
                },
              }}
            />
          ) : (
            <ComparisonWorkspace
              key={`${comparisonId}:${changeId ?? ""}`}
              comparison={query.data}
              fit
              initialChange={changeId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
