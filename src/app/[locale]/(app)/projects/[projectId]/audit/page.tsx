import { AuditPage } from "@/features/audit";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AuditPage projectId={projectId} />;
}
