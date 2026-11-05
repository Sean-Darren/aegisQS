"use client";
import { useEffect, useState } from "react";
import { translator } from "./copy";
import { api } from "./api";
import "./office";
export default function SignIn({
  mocking,
  loginPath,
  locale,
}: {
  mocking: boolean;
  loginPath: string;
  locale: "en" | "zh-HK";
}) {
  const t = translator(locale);
  const [officeReady, setOfficeReady] = useState(false);
  useEffect(() => {
    window.Office?.onReady(() => setOfficeReady(true));
  }, []);
  const [message, setMessage] = useState("");
  async function complete() {
    try {
      await new Promise<void>((resolve, reject) => {
        if (!window.Office)
          return reject(new Error("Office dialog is not ready. Try again."));
        window.Office.onReady(() => resolve());
      });
      if (mocking) {
        const response = await fetch("/api/auth/mock", {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Mock sign-in failed.");
      } else await api.me();
      const nonce = new URLSearchParams(location.search).get("nonce");
      if (!nonce) throw new Error("Open sign-in from the task pane.");
      window.Office!.context.ui.messageParent(JSON.stringify({ nonce }), {
        targetOrigin: location.origin,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    }
  }
  return (
    <main lang={locale}>
      <h1>{t("signinTitle")}</h1>
      <p>{t("signinBasis")}</p>
      {!mocking && (
        <a
          href={`${loginPath}${loginPath.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(typeof location === "undefined" ? "" : location.href)}`}
        >
          {t("openSignIn")}
        </a>
      )}
      <button disabled={!officeReady} onClick={() => void complete()}>
        {t("finish")}
      </button>
      <p role="alert">{message}</p>
      <p>{t("signinFooter")}</p>
    </main>
  );
}
