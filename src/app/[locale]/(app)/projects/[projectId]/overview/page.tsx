import { getTranslations } from "next-intl/server";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
export default async function Page() {
  const t = await getTranslations("Navigation");
  return <SectionPlaceholder label={t("overview")} />;
}
