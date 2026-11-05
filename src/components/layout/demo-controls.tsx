"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/states";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import type { User } from "@/schemas";
export function DemoControls({ user }: { user?: User }) {
  const t = useTranslations("Demo");
  const cache = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function reset(story: boolean) {
    setBusy(true);
    setError(false);
    try {
      await cache.cancelQueries();
      const demo = await import("@/mocks/demo");
      if (story) demo.prepareDemoStory();
      else demo.resetDemoData();
      cache.removeQueries({ type: "inactive" });
      await cache.resetQueries();
      if (pathname !== "/projects/P-001/overview")
        router.replace("/projects/P-001/overview");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_API_MOCKING !== "enabled" ||
    (!can(user, "document.upload") && !can(user, "admin.manage"))
  )
    return null;
  return (
    <div className="flex flex-wrap gap-2" aria-busy={busy}>
      {error && <ErrorState message={t("error")} />}
      <Button variant="ghost" disabled={busy} onClick={() => void reset(false)}>
        {t("reset")}
      </Button>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void reset(true)}
      >
        {t("start")}
      </Button>
    </div>
  );
}
