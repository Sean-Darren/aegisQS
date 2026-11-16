"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  FolderOpen,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, queryKeys, resources } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { formatDate, type FormatLocale } from "@/lib/format";
import { buildingTypes, type Project } from "@/schemas";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const [editTarget, setEditTarget] = useState<Project>();
  const [deleteTarget, setDeleteTarget] = useState<Project>();
  const canCreate = can(session.data, "project.create");
  const canEdit = can(session.data, "project.update");
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
            <Skeleton key={i} className="h-52 rounded-lg" />
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
              className="group relative rounded-lg border border-line bg-panel p-5 transition-colors hover:border-clay-600"
            >
              {/* Whole-card click target. The visual content is
                  pointer-transparent so the overlay link stays clickable
                  while the kebab menu above it remains interactive. */}
              <Link
                href={`/projects/${project.id}/overview`}
                aria-label={t("openAriaLabel", { name: project.name })}
                className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
              />
              <div className="relative pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-stone-50 text-clay-800">
                    <FolderOpen
                      size={18}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>
                  <Badge className="num shrink-0">{project.code}</Badge>
                </div>
                <h2 className="mt-4 text-lg font-semibold group-hover:text-clay-700">
                  {project.name}
                </h2>
                {project.location && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-ink">
                    <MapPin
                      size={14}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                    {project.location}
                  </p>
                )}
                {project.buildingType && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-ink">
                    <Building2
                      size={14}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                    {t(`buildingTypes.${project.buildingType}`)}
                  </p>
                )}
                <div className="mt-4 border-t border-line pt-3">
                  <span className="text-xs text-muted-ink">
                    {t("created", {
                      date: formatDate(project.createdAt, locale),
                    })}
                  </span>
                </div>
              </div>
              {(canEdit || canDelete) && (
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("cardActions", { name: project.name })}
                        className="rounded-md bg-panel p-1.5 text-muted-ink opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600 group-hover:opacity-100"
                      >
                        <MoreVertical
                          size={16}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {canEdit && (
                        <DropdownMenuItem
                          onSelect={() => setEditTarget(project)}
                        >
                          <Pencil
                            size={14}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          {t("editProject")}
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-risk"
                          onSelect={() => setDeleteTarget(project)}
                        >
                          <Trash2
                            size={14}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          {t("deleteProject")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {createOpen && <ProjectFormDialog onOpenChange={setCreateOpen} />}
      {editTarget && (
        <ProjectFormDialog
          key={editTarget.id}
          project={editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(undefined);
          }}
        />
      )}
      <DeleteProjectDialog
        project={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
      />
    </div>
  );
}

const NO_BUILDING_TYPE = "none";

function ProjectFormDialog({
  project,
  onOpenChange,
}: {
  project?: Project;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Projects");
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = !!project;
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [location, setLocation] = useState(project?.location ?? "");
  const [buildingType, setBuildingType] = useState(
    project?.buildingType ?? NO_BUILDING_TYPE,
  );
  const [nameTouched, setNameTouched] = useState(false);
  const showNameError = nameTouched && !name.trim();
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        code: code.trim() || undefined,
        location: location.trim() || null,
        buildingType:
          buildingType === NO_BUILDING_TYPE
            ? null
            : (buildingType as (typeof buildingTypes)[number]),
      };
      return editing && project
        ? resources.updateProject(project.id, body)
        : resources.createProject(body);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      toast(
        editing
          ? t("updatedProject", { name: saved.name })
          : t("createdProject", { name: saved.name }),
        "success",
      );
      onOpenChange(false);
      if (!editing) router.push(`/projects/${saved.id}/overview`);
    },
    onError: (error) =>
      toast(
        error instanceof ApiError
          ? error.message
          : editing
            ? t("updateError")
            : t("createError"),
        "error",
      ),
  });
  const disabled = !name.trim() || save.isPending;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="space-y-4">
        <DialogTitle className="pr-7 text-xl font-semibold">
          {editing ? t("editProject") : t("addProject")}
        </DialogTitle>
        <DialogDescription>
          {editing ? t("editProjectDescription") : t("addProjectDescription")}
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setNameTouched(true);
            if (!disabled) save.mutate();
          }}
        >
          <fieldset disabled={save.isPending} className="space-y-4">
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
                aria-describedby={
                  showNameError ? "project-name-error" : undefined
                }
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
                className={`${inputStyle} num`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={20}
              />
              <span className="mt-1 block text-xs text-muted-ink">
                {t("codeOptional")}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                {t("location")}
                <span className="ml-1 font-normal text-muted-ink">
                  {t("locationOptional")}
                </span>
              </span>
              <input
                className={inputStyle}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={140}
              />
            </label>
            <div className="block">
              <span className="mb-1 block text-sm font-medium">
                {t("buildingType")}
              </span>
              <Select
                value={buildingType}
                onValueChange={setBuildingType}
                disabled={save.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BUILDING_TYPE}>
                    {t("notSpecified")}
                  </SelectItem>
                  {buildingTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`buildingTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </fieldset>
          <div className="flex justify-end">
            <Button type="submit" disabled={disabled}>
              {save.isPending
                ? t("saving")
                : editing
                  ? t("saveChanges")
                  : t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
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
          <div className="flex justify-end">
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
