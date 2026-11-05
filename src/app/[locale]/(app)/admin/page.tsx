import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui";
export default async function Page() {
  const t = await getTranslations("Admin");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <EmptyState message={t("empty")} />
    </div>
  );
}
