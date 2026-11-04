import { MaterialForecastPage } from "@/features/materials";
export default async function Page({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = await params;
  return <MaterialForecastPage materialId={materialId} />;
}
