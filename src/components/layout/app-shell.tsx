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
import { ErrorState, Skeleton } from "@/components/ui";
import { Header } from "./header";
import { LeftNav } from "./left-nav";
import { EvidenceDrawer } from "./evidence-drawer";

const HeaderActionContext = createContext<(node?: ReactNode) => void>(() => {});
export function useHeaderAction() {
  return useContext(HeaderActionContext);
}
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Shell");
  const session = useSession();
  const [primaryAction, setPrimaryAction] = useState<ReactNode>();
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
    enabled: can(session.data, "project.view"),
  });
  const params = useParams<{ projectId?: string }>();
  const projectId = can(session.data, "project.view")
    ? params.projectId
    : undefined;
  return (
    <HeaderActionContext.Provider value={setPrimaryAction}>
      <div className="flex min-h-screen flex-col bg-surface text-ink">
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
        {session.isError ? (
          <main className="p-8">
            <ErrorState message={t("sessionError")} />
          </main>
        ) : (
          <div className="flex flex-1">
            {session.data && can(session.data, "project.view") && (
              <LeftNav
                projectId={projectId}
                showAdmin={can(session.data, "admin.manage")}
              />
            )}
            <main id="main-content" className="min-w-0 flex-1 p-6 lg:p-8">
              {session.data?.role === "owner_viewer" ? (
                <p className="rounded-lg border border-line bg-panel p-5">
                  {t("signedOnly")}
                </p>
              ) : (
                children
              )}
            </main>
          </div>
        )}
        <Suspense fallback={null}>
          <EvidenceDrawer />
        </Suspense>
      </div>
    </HeaderActionContext.Provider>
  );
}
