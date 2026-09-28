import type { ReactNode } from "react";
import { TenderTabs } from "@/components/layout/tender-tabs";
export default async function TenderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <>
      <TenderTabs projectId={projectId} />
      {children}
    </>
  );
}
