"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { can } from "@/lib/auth/permissions";
import type { User } from "@/schemas";

export function SignOffControls({
  user,
  blockingCount,
  disabledReason,
  recommendedTendererName,
  reviewHref,
  onReviewFlags,
  onConfirm,
  busy,
}: {
  user?: User;
  blockingCount: number;
  disabledReason?: string;
  recommendedTendererName: string;
  reviewHref: string;
  onReviewFlags: () => void;
  onConfirm: () => Promise<boolean>;
  busy: boolean;
}) {
  const t = useTranslations("Reports");
  const [open, setOpen] = useState(false);
  if (!can(user, "report.sign")) return null;
  const disabled = blockingCount > 0 || !!disabledReason || busy;
  const button = (
    <Button disabled={disabled} onClick={() => setOpen(true)}>
      {t("signOffReport")}
    </Button>
  );
  return (
    <>
      {disabled && !busy ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
              >
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent role="note">
              {blockingCount > 0 ? (
                <>
                  <p>{t("blockingCount", { count: blockingCount })}</p>
                  <a
                    href={reviewHref}
                    onClick={(event) => {
                      event.preventDefault();
                      onReviewFlags();
                    }}
                    className="mt-2 inline-block rounded-sm font-medium text-clay-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                  >
                    {t("reviewBlockingFlags")}
                  </a>
                </>
              ) : (
                disabledReason
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="pr-8 text-lg font-semibold">
            {t("confirmSignOffTitle")}
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-prose text-sm leading-6 text-muted-ink">
            {t("confirmSignOffBody", { tenderer: recommendedTendererName })}
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                void onConfirm().then((success) => {
                  if (success) setOpen(false);
                });
              }}
            >
              {busy ? t("signing") : t("confirmSignOff")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
