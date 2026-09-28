import { DocumentsWorkspace } from "@/features/documents";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DocumentsWorkspace projectId={projectId} />;
}
