"use client";
import { useTranslations } from "next-intl";
import { actorLabelKey } from "@/lib/format";

/** Renders an actor field (uploaded by / raised by / created by). These
 * fields store a role value; show the translated role label and fall back
 * to the raw value for unknown roles. */
export function Actor({ value }: { value?: string | null }) {
  const shell = useTranslations("Shell");
  const key = value ? actorLabelKey(value) : null;
  return <>{key ? shell(key) : (value ?? "…")}</>;
}
