import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui";
export async function ComingPage({ section }: { section: string }) {
  const t = await getTranslations("Navigation");
  const m = await getTranslations("Migration");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t(section)}</h1>
      <EmptyState message={m("coming")} />
    </div>
  );
}
