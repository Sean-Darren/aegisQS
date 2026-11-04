"use client";
import {
  Suspense,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { queryKeys, resources } from "@/lib/api";
import { useProjectEvents } from "@/lib/ws";

import { ErrorState, Skeleton } from "@/components/ui";
import { Header } from "./header";
import { LeftNav } from "./left-nav";
import { DetailDrawer } from "./detail-drawer";

const HeaderActionContext = createContext<(node?: ReactNode) => void>(() => {});
const MonitorProjectContext = createContext<(projectId: string) => void>(
  () => {},
);
export function useHeaderAction() {
  return useContext(HeaderActionContext);
}
export function useMonitorProject() {
  return useContext(MonitorProjectContext);
}
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Shell");

  const session = useSession();
  const [primaryAction, setPrimaryAction] = useState<ReactNode>();
  const [, setActiveProjectId] = useState("");
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
    enabled: can(session.data, "project.view"),
  });
  const params = useParams<{ projectId?: string }>();
  const projectId = can(session.data, "project.view")
    ? params.projectId
    : undefined;
  useProjectEvents(projectId ?? "");
  return (
    <MonitorProjectContext.Provider value={setActiveProjectId}>
      <HeaderActionContext.Provider value={setPrimaryAction}>
        <div className="flex min-h-screen bg-surface text-ink">
          {session.data &&
            !session.isError &&
            can(session.data, "project.view") && (
              <LeftNav
                projectId={projectId}
                showAdmin={can(session.data, "admin.manage")}
              />
            )}
          <div className="flex min-w-0 flex-1 flex-col">
            {session.isPending ? (
              <div className="border-b border-line bg-panel p-4">
                <Skeleton className="h-9 w-52" />
              </div>
            ) : (
              <Header
                user={session.data}
                projects={projects.data ?? []}
                projectId={projectId}
                primaryAction={primaryAction}
              />
            )}
            <main id="main-content" className="min-w-0 flex-1 p-6 lg:p-8">
              {session.isError ? (
                <ErrorState message={t("sessionError")} />
              ) : (
                <div className="mx-auto w-full max-w-[1600px]">{children}</div>
              )}
            </main>
          </div>
          <Suspense fallback={null}>
            <DetailDrawer />
          </Suspense>
        </div>
      </HeaderActionContext.Provider>
    </MonitorProjectContext.Provider>
  );
}
