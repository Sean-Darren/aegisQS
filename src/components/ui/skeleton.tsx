// Adapted from shadcn/ui Skeleton (MIT): https://ui.shadcn.com/docs/components/radix/skeleton
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="status"
      className={cn("rounded-sm bg-stone-50", className)}
      {...props}
    />
  );
}
