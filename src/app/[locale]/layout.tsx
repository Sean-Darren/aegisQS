import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { MockProvider } from "@/mocks/provider";
import { AppProviders } from "@/components/layout/providers";
import { karla, notoSansHK } from "../fonts";
import "../globals.css";
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Home" });
  return { title: t("title"), description: t("description") };
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={`${karla.variable} ${notoSansHK.variable}`}>
      <body>
        <NextIntlClientProvider>
          <MockProvider>
            <AppProviders>{children}</AppProviders>
          </MockProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
