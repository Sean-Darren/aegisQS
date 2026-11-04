import { VariationRegister } from "@/features/variations";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <VariationRegister projectId={projectId} />;
}
