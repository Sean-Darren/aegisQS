import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
export async function SectionPlaceholder({ label }: { label: string }) {
  const t = await getTranslations("Section");
  return (
    <section className="rounded-lg border border-line bg-panel p-8">
      <h1 className="text-2xl font-semibold">{label}</h1>
      <p className="mt-3 text-muted-ink">{t("placeholder")}</p>
      <Link
        href="/projects"
        className="mt-6 inline-block rounded-sm text-clay-800 underline focus-visible:outline-2 focus-visible:outline-clay-600"
      >
        {t("back")}
      </Link>
    </section>
  );
}
