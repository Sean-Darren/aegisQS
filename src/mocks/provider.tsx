"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
const enabled = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
export function MockProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Mock");
  const [status, setStatus] = useState(enabled ? "loading" : "ready");
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    import("./browser")
      .then(({ startMocking }) => startMocking())
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Mock services failed to start", error);
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);
  if (status === "error") return <p role="alert">{t("error")}</p>;
  if (status === "loading") return <p role="status">{t("loading")}</p>;
  return children;
}
