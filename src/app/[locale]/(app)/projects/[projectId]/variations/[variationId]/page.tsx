import { VariationPage } from "@/features/variations";
export default async function Page({
  params,
}: {
  params: Promise<{ variationId: string }>;
}) {
  const { variationId } = await params;
  return <VariationPage variationId={variationId} />;
}
