import { RateGrid } from "@/features/rate-grid";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <RateGrid projectId={projectId} />;
}
