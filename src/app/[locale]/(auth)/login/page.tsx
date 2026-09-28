import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";
export default async function LoginPage() {
  const t = await getTranslations("Login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="w-full max-w-md rounded-lg border border-line bg-panel p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-3 text-muted-ink">{t("description")}</p>
        <Button asChild className="mt-8">
          <Link href="/projects">{t("continue")}</Link>
        </Button>
      </section>
    </main>
  );
}
