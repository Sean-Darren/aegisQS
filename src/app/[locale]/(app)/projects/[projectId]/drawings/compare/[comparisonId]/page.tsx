import { ComparisonPage } from "@/features/drawings";
export default async function Page({
  params,
}: {
  params: Promise<{ comparisonId: string }>;
}) {
  const { comparisonId } = await params;
  return <ComparisonPage comparisonId={comparisonId} />;
}
