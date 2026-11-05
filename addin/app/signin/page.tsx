import SignIn from "../../src/signin";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const { locale } = await searchParams;
  return (
    <SignIn
      locale={locale === "zh-HK" ? "zh-HK" : "en"}
      mocking={process.env.ADDIN_API_MOCKING === "enabled"}
      loginPath={process.env.SMART_QS_LOGIN_URL ?? "/login"}
    />
  );
}
