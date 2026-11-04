import { WorkbookPage } from "@/features/workbooks";
export default async function Page({
  params,
}: {
  params: Promise<{ workbookId: string }>;
}) {
  const { workbookId } = await params;
  return <WorkbookPage workbookId={workbookId} />;
}
