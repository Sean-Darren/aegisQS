import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const error = (await searchParams).error;
  const mock = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
  const t = await getTranslations("Login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="w-full max-w-md rounded-lg border border-line bg-panel p-8">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-3 text-muted-ink">
          {t(mock ? "description" : "realDescription")}
        </p>
        {mock ? (
          <Button asChild className="mt-8">
            <Link href="/projects">{t("continue")}</Link>
          </Button>
        ) : (
          <form
            method="post"
            action="/api/auth/login"
            className="mt-6 space-y-4"
          >
            <input type="hidden" name="locale" value={locale} />
            <label className="block text-sm font-medium">
              {t("email")}
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className="mt-1 h-9 w-full rounded-md border border-line-strong bg-panel px-3 focus-visible:outline-2 focus-visible:outline-ring"
              />
            </label>
            <label className="block text-sm font-medium">
              {t("password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 h-9 w-full rounded-md border border-line-strong bg-panel px-3 focus-visible:outline-2 focus-visible:outline-ring"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-risk">
                {t("error")}
              </p>
            )}
            <Button type="submit">{t("signIn")}</Button>
          </form>
        )}
      </section>
    </main>
  );
}
