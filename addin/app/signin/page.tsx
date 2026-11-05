import SignIn from "../../src/signin";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = params.locale === "zh-HK" ? "zh-HK" : "en";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value))
      value.forEach((entry) => query.append(key, entry));
    else if (value !== undefined) query.set(key, value);
  }
  const returnTo = `/signin${query.size ? `?${query}` : ""}`;
  return (
    <SignIn
      locale={locale === "zh-HK" ? "zh-HK" : "en"}
      mocking={process.env.ADDIN_API_MOCKING === "enabled"}
      returnTo={returnTo}
      loginPath={process.env.SMART_QS_LOGIN_URL ?? "/login"}
    />
  );
}
