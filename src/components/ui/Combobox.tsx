// Original Smart QS composition of Radix Popover (WorkOS, MIT).
// Reference: https://www.radix-ui.com/primitives/docs/components/popover
"use client";
import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";
export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export function Combobox({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
  onSearchChange,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  disabled?: boolean;
  onSearchChange?: (query: string) => void;
}) {
  const t = useTranslations("Primitives");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const visible = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const enabled = visible.filter((option) => !option.disabled);
  const selected = options.find((option) => option.value === value);
  const highlighted = enabled[Math.min(active, enabled.length - 1)];
  function choose(next: string) {
    onValueChange(next);
    setOpen(false);
    setQuery("");
  }
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }
  return (
    <Popover.Root open={open && !disabled} onOpenChange={changeOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <input
            ref={input}
            role="combobox"
            aria-label={label}
            aria-expanded={open && !disabled}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={
              open && highlighted
                ? `${id}-${options.indexOf(highlighted)}`
                : undefined
            }
            disabled={disabled}
            value={open ? query : (selected?.label ?? "")}
            placeholder={t("search")}
            onFocus={() => {
              setOpen(true);
              setActive(0);
            }}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearchChange?.(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                if (!open && ["Home", "End"].includes(event.key)) return;
                event.preventDefault();
                setOpen(true);
                if (!open) setActive(0);
                else if (event.key === "Home") setActive(0);
                else if (event.key === "End")
                  setActive(Math.max(0, enabled.length - 1));
                else
                  setActive((index) =>
                    Math.max(
                      0,
                      Math.min(
                        enabled.length - 1,
                        index + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
                  );
              } else if (event.key === "Enter" && open) {
                event.preventDefault();
                if (highlighted) choose(highlighted.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                changeOpen(false);
              } else if (event.key === "Tab") changeOpen(false);
            }}
            className="h-9 w-full rounded-md border border-line-strong bg-panel px-3 pr-9 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 disabled:cursor-not-allowed disabled:opacity-45"
          />
          <ChevronsUpDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-2.5 text-muted-ink"
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          role="presentation"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (event.target === input.current) event.preventDefault();
          }}
          className="floating-layer z-50 w-[var(--radix-popover-trigger-width)] min-w-56 rounded-md border border-line bg-panel p-1 text-ink"
        >
          <div
            role="listbox"
            id={`${id}-list`}
            aria-label={label}
            className="max-h-64 overflow-auto"
          >
            {visible.map((option) => (
              <div
                key={option.value}
                role="option"
                id={`${id}-${options.indexOf(option)}`}
                aria-selected={value === option.value}
                aria-disabled={option.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => {
                  if (!option.disabled) setActive(enabled.indexOf(option));
                }}
                onClick={() => {
                  if (!option.disabled) choose(option.value);
                }}
                className={`flex min-h-9 cursor-default items-center justify-between gap-3 rounded-sm px-3 text-sm ${highlighted?.value === option.value ? "bg-limewash-100" : ""} ${option.disabled ? "opacity-45" : ""}`}
              >
                {option.label}
                {value === option.value && (
                  <Check size={14} strokeWidth={1.5} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
          {visible.length === 0 && (
            <p role="status" className="p-3 text-sm text-muted-ink">
              {t("noOptions")}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
