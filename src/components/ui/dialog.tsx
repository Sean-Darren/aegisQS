// Adapted from shadcn/ui Dialog (MIT): https://ui.shadcn.com/docs/components/radix/dialog
"use client";
import type { ComponentProps, ReactNode } from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content> & { children: ReactNode }) {
  const t = useTranslations("Common");
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-[fade-in_120ms_ease-out]" />
      <Primitive.Content
        className={cn(
          "floating-layer fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-panel p-5 text-ink focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          aria-label={t("close")}
          className="absolute right-4 top-4 rounded-sm text-muted-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
        >
          <X size={16} strokeWidth={1.5} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
