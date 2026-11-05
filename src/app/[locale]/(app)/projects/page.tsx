"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { formatDate, type FormatLocale } from "@/lib/format";
import type { Project } from "@/schemas";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";

export default function ProjectsPage() {
  const t = useTranslations("Projects");
  const common = useTranslations("Common");
  const locale = useLocale() as FormatLocale;
  const session = useSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project>();
  const canCreate = can(session.data, "project.create");
  const canDelete = can(session.data, "project.delete");
  const projects = useQuery({
    queryKey: queryKeys.projects(),
    queryFn: resources.projects,
    enabled: can(session.data, "project.view"),
  });
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-ink">{t("description")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            {t("addProject")}
          </Button>
        )}
      </div>
      {projects.isPending && can(session.data, "project.view") && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      )}
      {projects.isError && (
        <ErrorState
          message={t("error")}
          action={{
            label: common("retry"),
            onClick: () => void projects.refetch(),
          }}
        />
      )}
      {projects.data?.length === 0 && <EmptyState message={t("empty")} />}
      {projects.data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <article
              key={project.id}
              className="rounded-lg border border-line bg-panel p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-md bg-stone-50 text-clay-800">
                  <FolderOpen size={18} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="num text-xs text-muted-ink">
                  {project.code}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{project.name}</h2>
              <div className="mt-5 flex items-end justify-between gap-2 border-t border-line pt-4">
                <span className="text-xs text-muted-ink">
                  {t("created", {
                    date: formatDate(project.createdAt, locale),
                  })}
                </span>
                <div className="flex items-center gap-2">
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(project)}
                    >
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                      {t("deleteProject")}
                    </Button>
                  )}
                  <Link
                    href={`/projects/${project.id}/overview`}
                    className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-clay-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                  >
                    {t("open")}
                    <ArrowUpRight
                      size={14}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <DeleteProjectDialog
        project={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
      />
    </div>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Projects");
  const common = useTranslations("Common");
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const showNameError = nameTouched && !name.trim();
  const create = useMutation({
    mutationFn: () =>
      resources.createProject({
        name: name.trim(),
        code: code.trim() || undefined,
      }),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      toast(t("createdProject", { name: project.name }), "success");
      setName("");
      setCode("");
      setNameTouched(false);
      onOpenChange(false);
      router.push(`/projects/${project.id}/overview`);
    },
    onError: (error) =>
      toast(
        error instanceof ApiError ? error.message : t("createError"),
        "error",
      ),
  });
  const disabled = !name.trim() || create.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="space-y-4">
          <DialogTitle className="pr-7 text-xl font-semibold">
            {t("addProject")}
          </DialogTitle>
          <DialogDescription>{t("addProjectDescription")}</DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setNameTouched(true);
              if (!disabled) create.mutate();
            }}
          >
            <fieldset disabled={create.isPending} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  {t("name")}
                </span>
                <input
                  className={inputStyle}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => setNameTouched(true)}
                  aria-invalid={showNameError}
                  aria-describedby={showNameError ? "project-name-error" : undefined}
                  maxLength={120}
                />
                {showNameError && (
                  <p
                    id="project-name-error"
                    role="alert"
                    className="mt-1 text-sm text-risk"
                  >
                    {t("nameRequired")}
                  </p>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  {t("code")}
                </span>
                <input
                  className={inputStyle}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={20}
                />
                <span className="mt-1 block text-xs text-muted-ink">
                  {t("codeOptional")}
                </span>
              </label>
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNameTouched(false);
                  onOpenChange(false);
                }}
              >
                {common("close")}
              </Button>
              <Button type="submit" disabled={disabled}>
                {create.isPending ? t("creating") : t("create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

function DeleteProjectDialog({
  project,
  onOpenChange,
}: {
  project?: Project;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Projects");
  const common = useTranslations("Common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => resources.deleteProject(project!.id),
    onSuccess: async (deleted) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      toast(t("deletedProject", { name: deleted.name }), "success");
      onOpenChange(false);
    },
    onError: (error) =>
      toast(
        error instanceof ApiError ? error.message : t("deleteError"),
        "error",
      ),
  });
  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      {project && (
        <DialogContent className="space-y-4">
          <DialogTitle className="pr-7 text-xl font-semibold">
            {t("deleteProject")}
          </DialogTitle>
          <DialogDescription>
            {t("deleteProjectDescription", { name: project.name })}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {common("close")}
            </Button>
            <Button
              variant="danger"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? t("deleting") : t("delete")}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
