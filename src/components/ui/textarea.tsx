// Adapted from shadcn/ui Textarea (MIT): https://ui.shadcn.com/docs/components/radix/textarea
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-line-strong bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 disabled:opacity-45 aria-invalid:border-risk",
        className,
      )}
      {...props}
    />
  );
}
