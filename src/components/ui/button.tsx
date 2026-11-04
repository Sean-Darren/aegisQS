// Adapted from shadcn/ui Button (MIT): https://ui.shadcn.com/docs/components/radix/button
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
export const buttonVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-clay-700 text-primary-foreground hover:bg-clay-800",
        primary: "bg-clay-700 text-primary-foreground hover:bg-clay-800",
        secondary: "bg-limewash text-clay-800 hover:bg-limewash-100",
        outline:
          "border border-line-strong bg-panel text-ink hover:bg-stone-50",
        ghost: "text-muted-ink hover:bg-stone-50 hover:text-ink",
        "on-ink":
          "bg-transparent text-limewash hover:bg-sidebar-hover focus-visible:outline-sidebar-ring",
        danger: "bg-risk text-primary-foreground hover:bg-risk/90",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(!asChild ? { type } : {})}
      {...props}
    />
  );
}
