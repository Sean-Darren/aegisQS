"use client";
import type { ComponentProps } from "react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={6}
        align="end"
        className={cn(
          "floating-layer z-50 min-w-44 rounded-md border border-line bg-panel p-1 text-sm text-ink",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors focus:bg-stone-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
