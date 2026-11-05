// Adapted from shadcn/ui Select (MIT): https://ui.shadcn.com/docs/components/radix/select
"use client";
import type { ComponentProps } from "react";
import { Select as Primitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;
export const SelectGroup = Primitive.Group;
export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "inline-flex h-9 min-w-36 items-center justify-between gap-2 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
      <Primitive.Icon>
        <ChevronDown size={16} strokeWidth={1.5} />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
}
export function SelectContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "floating-layer z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-md border border-line bg-panel p-1 text-ink",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "relative flex h-9 cursor-default items-center rounded-sm py-1 pl-8 pr-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 data-[highlighted]:bg-limewash-100 data-[disabled]:opacity-45",
        className,
      )}
      {...props}
    >
      <Primitive.ItemIndicator className="absolute left-2">
        <Check size={14} strokeWidth={1.5} />
      </Primitive.ItemIndicator>
      <Primitive.ItemText>{children}</Primitive.ItemText>
    </Primitive.Item>
  );
}
