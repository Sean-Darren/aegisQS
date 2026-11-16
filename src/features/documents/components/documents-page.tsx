"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Upload } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
import { documentCategorySchema } from "@/schemas";
import { inputStyle } from "@/components/ui/form-styles";
import { UploadQueue } from "./upload-queue";
export function DocumentsPage({ projectId }: { projectId: string }) {
  const t = useTranslations("Hub");
  const locale = useLocale() as FormatLocale;
  const session = useSession();
  const router = useRouter();
  const { documents, allVersions, versions } = useProjectDocuments(projectId);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [conflicts, setConflicts] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const data = documents.data ?? [];
  const visible = data.filter(
    (d) =>
      (!category || d.category === category) &&
      (!conflicts || d.hasConflict) &&
      `${d.docNumber} ${d.title}`.toLowerCase().includes(search.toLowerCase()),
  );
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
        <Button
          variant={category === "" ? "primary" : "outline"}
          onClick={() => setCategory("")}
        >
          {t("all")} <span className="tabular-nums">{data.length}</span>
        </Button>
        {documentCategorySchema.options.map((c) => (
          <Button
            key={c}
            variant={category === c ? "primary" : "outline"}
            onClick={() => setCategory(c)}
          >
            {t(`categories.${c}`)}{" "}
            <span className="tabular-nums">
              {data.filter((d) => d.category === c).length}
            </span>
          </Button>
        ))}
        <input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          className={`${inputStyle} ml-auto w-56`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={conflicts}
            onChange={(e) => setConflicts(e.target.checked)}
          />
          {t("conflictsOnly")}
        </label>
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
                    {current?.uploadedBy ?? "…"}
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
