import { ScopeWorkspace } from "@/features/scope-gaps";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ScopeWorkspace projectId={projectId} />;
}
