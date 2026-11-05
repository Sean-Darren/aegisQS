// Adapted from shadcn/ui Sheet (MIT): https://ui.shadcn.com/docs/components/radix/sheet
"use client";
import type { ComponentProps, ReactNode } from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;
export const SheetTitle = Primitive.Title;
export const SheetDescription = Primitive.Description;
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content> & { children: ReactNode }) {
  const t = useTranslations("Common");
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <Primitive.Content
        className={cn(
          "floating-layer fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col rounded-l-lg border-l border-line bg-panel text-ink transition-transform duration-200 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 motion-reduce:transition-none sm:w-[min(640px,calc(100vw-1rem))]",
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
