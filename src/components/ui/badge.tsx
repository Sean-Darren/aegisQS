// Adapted from shadcn/ui Badge (MIT): https://ui.shadcn.com/docs/components/radix/badge
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border border-line bg-stone-50 px-2 text-xs font-medium text-ink",
        className,
      )}
      {...props}
    />
  );
}
