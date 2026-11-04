"use client";
import {
  Suspense,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { queryKeys, resources } from "@/lib/api";
import { useProjectEvents } from "@/lib/ws";

import { useToast } from "@/components/ui/toast";
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
  const drawing = useTranslations("Drawing");
  const workbookCopy = useTranslations("Workbooks");
  const toast = useToast();

  const session = useSession();
  const [primaryAction, setPrimaryAction] = useState<ReactNode>();
  const [, setActiveProjectId] = useState("");
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
    enabled: can(session.data, "project.view"),
  });
  const params = useParams<{ projectId?: string }>();
  const comparing = usePathname().includes("/drawings/compare/");
  const projectId = can(session.data, "project.view")
    ? params.projectId
    : undefined;
  useProjectEvents(projectId ?? "", (event) => {
    if (event.type === "workbook.checked")
      toast(
        workbookCopy(
          "completed",
          event.checkSummary ?? { errors: 0, warnings: 0, info: 0 },
        ),
        "success",
        {
          label: workbookCopy("open"),
          href: `/projects/${projectId}/workbooks/${event.workbookId}?version=${event.versionId}`,
        },
      );
    if (event.type === "comparison.completed")
      toast(
        event.status === "succeeded"
          ? drawing("ready", { count: event.changeCount })
          : drawing("error"),
        event.status === "succeeded" ? "success" : "error",
        {
          label: drawing("openComparison"),
          href: `/projects/${projectId}/drawings/compare/${event.comparisonId}`,
        },
      );
  });
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
            <main
              id="main-content"
              className={
                comparing ? "min-w-0 flex-1 p-4" : "min-w-0 flex-1 p-6 lg:p-8"
              }
            >
              {session.isError ? (
                <ErrorState message={t("sessionError")} />
              ) : (
                <div
                  className={
                    comparing ? "w-full" : "mx-auto w-full max-w-[1600px]"
                  }
                >
                  {children}
                </div>
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
