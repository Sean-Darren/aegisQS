"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Check, Filter, Upload } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  Actor,
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
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { VirtualTable } from "@/components/grid";
import { useProjectDocuments } from "@/lib/api/use-records";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  formatDate,
  formatRevisionLabel,
  type FormatLocale,
} from "@/lib/format";
import { documentCategorySchema, disciplineSchema } from "@/schemas";
import { UploadQueue } from "./upload-queue";

function FilterMenuSection({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-ink">
        {label}
      </p>
      {options.map((option) => (
        <DropdownMenuItem
          key={option.value}
          onSelect={() => onChange(option.value)}
        >
          <span className="flex min-w-4 items-center">
            {value === option.value && (
              <Check size={14} strokeWidth={2} aria-hidden="true" />
            )}
          </span>
          <span className="flex-1">{option.label}</span>
          {option.count !== undefined && (
            <span className="num text-xs text-muted-ink">{option.count}</span>
          )}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function DocumentsPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Hub");
  const locale = useLocale() as FormatLocale;
  const session = useSession();
  const router = useRouter();
  const { documents, allVersions, versions } = useProjectDocuments(projectId);
  const [category, setCategory] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const data = documents.data ?? [];
  const visible = data.filter(
    (d) =>
      (!category || d.category === category) &&
      (!discipline || d.discipline === discipline) &&
      (!status || (status === "conflict" ? d.hasConflict : !d.hasConflict)) &&
      `${d.docNumber} ${d.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  const activeFilters = [category, discipline, status].filter(Boolean).length;
  const resetFilters = () => {
    setCategory("");
    setDiscipline("");
    setStatus("");
  };
  const fields = [
    "number",
    "title",
    "category",
    "discipline",
    "revision",
    "status",
    "updated",
    "uploader",
  ];
  return (
    <div className="space-y-5">
      <header className="flex justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("register")}</h1>
        {can(session.data, "document.upload") && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload size={16} strokeWidth={2} aria-hidden="true" />
            {t("upload")}
          </Button>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter size={16} strokeWidth={2} aria-hidden="true" />
              {t("filters")}
              {activeFilters > 0 && (
                <span className="num ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-700 px-1 text-xs font-semibold text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72">
            <FilterMenuSection
              label={t("category")}
              value={category}
              onChange={setCategory}
              options={[
                { value: "", label: t("all"), count: data.length },
                ...documentCategorySchema.options.map((c) => ({
                  value: c,
                  label: t(`categories.${c}`),
                  count: data.filter((d) => d.category === c).length,
                })),
              ]}
            />
            <div className="my-1 h-px bg-line" />
            <FilterMenuSection
              label={t("discipline")}
              value={discipline}
              onChange={setDiscipline}
              options={[
                { value: "", label: t("all"), count: data.length },
                ...disciplineSchema.options.map((d) => ({
                  value: d,
                  label: t(`disciplines.${d}`),
                  count: data.filter((doc) => doc.discipline === d).length,
                })),
              ]}
            />
            <div className="my-1 h-px bg-line" />
            <FilterMenuSection
              label={t("status")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: t("all"), count: data.length },
                {
                  value: "current",
                  label: t("current"),
                  count: data.filter((d) => !d.hasConflict).length,
                },
                {
                  value: "conflict",
                  label: t("conflict"),
                  count: data.filter((d) => d.hasConflict).length,
                },
              ]}
            />
            {activeFilters > 0 && (
              <>
                <div className="my-1 h-px bg-line" />
                <DropdownMenuItem onSelect={resetFilters}>
                  {t("resetFilters")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          className="ml-auto h-9 w-56 shrink-0 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {documents.isPending && <Skeleton className="h-96 w-full" />}
      {documents.isError && (
        <ErrorState
          message={t("error")}
          action={{
            label: t("retry"),
            onClick: () => void documents.refetch(),
          }}
        />
      )}
      {versions.some((q) => q.isError) && (
        <ErrorState
          message={t("versionError")}
          action={{
            label: t("retry"),
            onClick: () =>
              versions.forEach((q) => {
                if (q.isError) void q.refetch();
              }),
          }}
        />
      )}
      {documents.data && visible.length === 0 && (
        <EmptyState message={data.length ? t("noMatches") : t("empty")} />
      )}
      {visible.length > 0 && (
        <div className="rounded-lg border border-line bg-panel">
          <VirtualTable
            autoHeight
            label={t("register")}
            rows={visible}
            rowHeight={48}
            onRowClick={(doc) =>
              router.push(
                `/projects/${projectId}/documents?detail=document:${doc.id}`,
                { scroll: false },
              )
            }
            columns="120px minmax(200px,2fr) 130px 140px 90px 130px 150px 120px"
            header={
              <>
                {fields.map((f) => (
                  <div
                    role="columnheader"
                    className="px-3 py-3 text-xs font-medium text-muted-ink"
                    key={f}
                  >
                    {t(f)}
                  </div>
                ))}
              </>
            }
            renderRow={(doc) => {
              const current = allVersions.find(
                (v) => v.id === doc.currentVersionId,
              );
              const cell = "truncate border-t border-line px-3 py-3 text-sm";
              return (
                <>
                  <div role="cell" className={cell}>
                    <Link
                      href={`/projects/${projectId}/documents?detail=document:${doc.id}`}
                      className="rounded-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-clay-600"
                    >
                      {doc.docNumber}
                    </Link>
                  </div>
                  <div role="cell" className={cell} title={doc.title}>
                    {doc.title}
                  </div>
                  <div role="cell" className={cell}>
                    {t(`categories.${doc.category}`)}
                  </div>
                  <div role="cell" className={cell}>
                    {doc.discipline
                      ? t(`disciplines.${doc.discipline}`)
                      : t("notSpecified")}
                  </div>
                  <div role="cell" className={`${cell} tabular-nums`}>
                    {current ? formatRevisionLabel(current.label) : "…"}
                  </div>
                  <div role="cell" className={cell}>
                    <StatusChip
                      domain="versionStatus"
                      value={doc.hasConflict ? "conflict" : "current"}
                      compact
                    />
                  </div>
                  <div
                    role="cell"
                    className={`${cell} tabular-nums text-right`}
                  >
                    {formatDate(doc.updatedAt, locale)}
                  </div>
                  <div role="cell" className={cell}>
                    <Actor value={current?.uploadedBy} />
                  </div>
                </>
              );
            }}
          />
        </div>
      )}
      {uploadOpen && can(session.data, "document.upload") && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setUploadOpen(false);
          }}
        >
          <DialogContent className="max-h-[85vh] space-y-4 overflow-y-auto">
            <DialogTitle className="pr-7 text-xl font-semibold">
              {t("upload")}
            </DialogTitle>
            <DialogDescription>{t("uploadDescription")}</DialogDescription>
            <UploadQueue projectId={projectId} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
