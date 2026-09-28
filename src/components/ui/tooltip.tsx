// Adapted from shadcn/ui Tooltip (MIT): https://ui.shadcn.com/docs/components/radix/tooltip
"use client";
import type { ComponentProps } from "react";
import { Tooltip as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";
export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;
export function TooltipContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={6}
        className={cn(
          "floating-layer z-50 max-w-xs rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
