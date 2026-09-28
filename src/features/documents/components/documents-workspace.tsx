"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { AuditorKind, Project } from "@/schemas";
import { queryKeys, resources, useLatestProjectJob } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import {
  useToast,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useMonitorProject } from "@/components/layout/app-shell";
import { uploadDocumentWithProgress } from "../api";
import type { UploadSelection } from "../validation";
import { UploadForm } from "./upload-form";
import { DocumentIndex } from "./document-index";
import { ProgressMatrix } from "./progress-matrix";

export function DocumentsWorkspace({ projectId }: { projectId: string }) {
  const t = useTranslations("Documents");
  const jobsT = useTranslations("Jobs");
  const common = useTranslations("Common");
  const session = useSession();
  const client = useQueryClient();
  const toast = useToast();
  const monitorProject = useMonitorProject();
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const documents = useQuery({
    queryKey: queryKeys.documents(projectId),
    queryFn: () => resources.documents(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((doc) =>
        ["queued", "parsing"].includes(doc.parseStatus),
      )
        ? 1000
        : false,
  });
  const tenderers = useQuery({
    queryKey: queryKeys.tenderers(projectId),
    queryFn: () => resources.tenderers(projectId),
  });
  const latest = useLatestProjectJob(projectId);
  const canUpload = can(session.data, "document.upload");
  const canRun = can(session.data, "analysis.run");
  const hasParsedPricedBoq =
    documents.data?.some(
      (doc) => doc.type === "priced_boq" && doc.parseStatus === "parsed",
    ) ?? false;
  const isRunning =
    !!latest.job.data && ["queued", "running"].includes(latest.job.data.status);
  const reason = !hasParsedPricedBoq
    ? jobsT("needsPricedBoq")
    : isRunning
      ? jobsT("alreadyRunning")
      : null;

  async function upload(
    selection: UploadSelection,
    onProgress: (pct: number) => void,
  ) {
    await uploadDocumentWithProgress(projectId, selection, onProgress);
    await client.invalidateQueries({
      queryKey: queryKeys.documents(projectId),
    });
    toast(t("uploadComplete"), "success");
  }
  async function reprocess(documentId: string) {
    const updated = await resources.reprocessDocument(documentId);
    client.setQueryData(
      queryKeys.documents(projectId),
      (old: typeof documents.data) =>
        old?.map((item) => (item.id === documentId ? updated : item)),
    );
    await client.invalidateQueries({
      queryKey: queryKeys.documents(projectId),
    });
    toast(t("reprocessStarted"), "info");
  }
  async function runAnalysis() {
    if (reason || !canRun || runBusy) return;
    setRunBusy(true);
    setRunError(false);
    try {
      const job = await resources.runAnalysis(projectId);
      monitorProject(projectId);
      client.setQueryData(queryKeys.job(job.id), job);
      client.setQueryData<Project>(queryKeys.project(projectId), (old) =>
        old ? { ...old, latestJobId: job.id } : old,
      );
      await client.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
      toast(jobsT("started"), "info");
    } catch {
      setRunError(true);
    } finally {
      setRunBusy(false);
    }
  }
  async function retryAuditor(tendererId: string, auditor: AuditorKind) {
    const job = latest.job.data;
    if (!job || !canRun) return;
    setRetryError(false);
    try {
      const updated = await resources.retryAuditor(job.id, tendererId, auditor);
      client.setQueryData(queryKeys.job(job.id), updated);
      toast(jobsT("retryStarted"), "info");
    } catch {
      setRetryError(true);
    }
  }
  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-muted-ink">{t("description")}</p>
        </div>
        {canRun && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={reason ? 0 : -1}
                className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
              >
                <Button
                  disabled={!!reason || runBusy}
                  onClick={() => void runAnalysis()}
                >
                  {jobsT("run")}
                </Button>
              </span>
            </TooltipTrigger>
            {reason && <TooltipContent>{reason}</TooltipContent>}
          </Tooltip>
        )}
      </div>
      {runError && (
        <ErrorState
          message={jobsT("startFailed")}
          action={{ label: common("retry"), onClick: () => void runAnalysis() }}
        />
      )}
      {canUpload &&
        (tenderers.data ? (
          <UploadForm tenderers={tenderers.data} onUpload={upload} />
        ) : tenderers.isError ? (
          <ErrorState
            message={t("loadError")}
            action={{
              label: common("retry"),
              onClick: () => void tenderers.refetch(),
            }}
          />
        ) : (
          <Skeleton className="h-40 rounded-lg" />
        ))}
      {documents.isPending && <Skeleton className="mt-6 h-48 rounded-lg" />}
      {documents.isError && (
        <div className="mt-6">
          <ErrorState
            message={t("loadError")}
            action={{
              label: common("retry"),
              onClick: () => void documents.refetch(),
            }}
          />
        </div>
      )}
      {documents.data?.length === 0 && (
        <div className="mt-6">
          <EmptyState message={t("empty")} />
        </div>
      )}
      {documents.data && documents.data.length > 0 && (
        <DocumentIndex
          documents={documents.data}
          tenderers={tenderers.data ?? []}
          canReprocess={canUpload}
          onReprocess={reprocess}
        />
      )}
      {retryError && (
        <div className="mt-6">
          <ErrorState message={jobsT("retryFailed")} />
        </div>
      )}
      {latest.project.isError || latest.job.isError ? (
        <div className="mt-6">
          <ErrorState
            message={jobsT("loadError")}
            action={{
              label: common("retry"),
              onClick: () => {
                void latest.project.refetch();
                void latest.job.refetch();
              },
            }}
          />
        </div>
      ) : latest.job.data ? (
        <ProgressMatrix
          job={latest.job.data}
          tenderers={tenderers.data ?? []}
        canRetry={canRun && ["partial", "failed"].includes(latest.job.data.status)}
          onRetry={(tendererId, auditor) =>
            void retryAuditor(tendererId, auditor)
          }
        />
      ) : latest.project.isPending ||
        (latest.job.isPending && latest.project.data?.latestJobId) ? (
        <Skeleton className="mt-6 h-48 rounded-lg" />
      ) : (
        <div className="mt-6">
          <EmptyState message={jobsT("noJob")} />
        </div>
      )}
    </div>
  );
}
