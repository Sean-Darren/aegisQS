import { DrawingRegister } from "@/features/drawings";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DrawingRegister projectId={projectId} />;
}
