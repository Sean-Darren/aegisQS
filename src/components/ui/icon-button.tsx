import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
export function IconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & Omit<
  ButtonProps,
  "children" | "aria-label"
>) {
  return (
    <Button aria-label={label} size="icon" variant="ghost" {...props}>
      {children}
    </Button>
  );
}
