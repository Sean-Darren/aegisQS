import { getTranslations, setRequestLocale } from "next-intl/server";
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("description")}</p>
    </main>
  );
}
