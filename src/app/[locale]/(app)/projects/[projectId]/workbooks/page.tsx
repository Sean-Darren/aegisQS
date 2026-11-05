import { WorkbooksPage } from "@/features/workbooks";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <WorkbooksPage projectId={projectId} />;
}
