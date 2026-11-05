import { translator } from "../../src/copy";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string; returnTo?: string; error?: string }>;
}) {
  const params = await searchParams,
    locale = params.locale === "zh-HK" ? "zh-HK" : "en",
    t = translator(locale);
  return (
    <main lang={locale}>
      <h1>{t("signinTitle")}</h1>
      <form method="post" action="/api/auth/login">
        <input
          type="hidden"
          name="returnTo"
          value={params.returnTo ?? "/signin"}
        />
        <input type="hidden" name="locale" value={locale} />
        <label>
          {t("email")}
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          {t("password")}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {params.error && <p role="alert">{t("loginError")}</p>}
        <button type="submit">{t("openSignIn")}</button>
      </form>
    </main>
  );
}
