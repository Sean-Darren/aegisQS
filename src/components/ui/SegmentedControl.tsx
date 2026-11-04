// Original Smart QS composition of Radix ToggleGroup (WorkOS, MIT).
// Reference: https://www.radix-ui.com/primitives/docs/components/toggle-group
"use client";
import { ToggleGroup } from "radix-ui";
export function SegmentedControl({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      disabled={disabled}
      className="inline-flex gap-1 rounded-md border border-line-strong bg-panel p-1"
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="h-8 rounded-sm px-3 text-sm text-muted-ink data-[state=on]:bg-limewash-100 data-[state=on]:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
