"use client";
import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  documentTypeSchema,
  type DocumentType,
  type Tenderer,
} from "@/schemas";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  validateUploadSelection,
  type UploadIssue,
  type UploadSelection,
} from "../validation";

type QueueItem = {
  id: number;
  file: File;
  type: DocumentType | "";
  tendererId: string;
  pct: number;
  status: "ready" | "uploading" | "uploaded" | "failed";
  issue?: UploadIssue;
};
export function UploadForm({
  tenderers,
  onUpload,
}: {
  tenderers: Tenderer[];
  onUpload: (
    selection: UploadSelection,
    onProgress: (pct: number) => void,
  ) => Promise<void>;
}) {
  const t = useTranslations("Documents");
  const types = useTranslations("DocumentTypes");
  const nextId = useRef(0);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  function addFiles(files: FileList | File[]) {
    const added = Array.from(files).map((file) => ({
      id: ++nextId.current,
      file,
      type: "" as const,
      tendererId: "",
      pct: 0,
      status: "ready" as const,
    }));
    setItems((old) => [...old, ...added]);
  }
  function update(id: number, change: Partial<QueueItem>) {
    setItems((old) =>
      old.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }
  async function submit() {
    const pending = items.filter((item) => item.status !== "uploaded");
    let hasIssue = false;
    for (const item of pending) {
      const issue = validateUploadSelection(
        item.file,
        item.type,
        item.tendererId,
      );
      update(item.id, { issue: issue ?? undefined });
      if (issue) hasIssue = true;
    }
    if (hasIssue || !pending.length) return;
    setBusy(true);
    await Promise.all(
      pending.map(async (item) => {
        update(item.id, { status: "uploading", pct: 0, issue: undefined });
        try {
          await onUpload(
            {
              file: item.file,
              type: item.type as DocumentType,
              tendererId: item.tendererId || undefined,
            },
            (pct) => update(item.id, { pct }),
          );
          update(item.id, { status: "uploaded", pct: 100 });
        } catch {
          update(item.id, { status: "failed" });
        }
      }),
    );
    setBusy(false);
  }
  const issueText = {
    file: t("fileRequired"),
    type: t("typeRequired"),
    tenderer: t("tendererRequired"),
  };
  return (
    <section
      className="rounded-lg border border-line bg-panel p-5"
      aria-labelledby="upload-title"
    >
      <h2 id="upload-title" className="text-lg font-semibold">
        {t("uploadTitle")}
      </h2>
      <label
        className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-clay-600 ${dragging ? "border-clay-600 bg-limewash-100" : "border-line-strong"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <FileUp
          size={20}
          strokeWidth={1.5}
          className="text-clay-600"
          aria-hidden="true"
        />
        <span className="text-sm text-ink">{t("dropFiles")}</span>
        <span className="text-sm font-semibold text-clay-800 underline">
          {t("chooseFiles")}
        </span>
        <input
          type="file"
          multiple
          className="sr-only"
          aria-label={t("chooseFiles")}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-line bg-surface p-3"
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1 break-all text-sm font-medium">
                  {item.file.name}
                </span>
                <IconButton
                  label={`${t("removeFile")}: ${item.file.name}`}
                  size="icon-sm"
                  disabled={busy}
                  onClick={() =>
                    setItems((old) =>
                      old.filter((entry) => entry.id !== item.id),
                    )
                  }
                >
                  <X size={16} strokeWidth={1.5} />
                </IconButton>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-ink">
                  {t("type")}
                  <select
                    value={item.type}
                    disabled={busy || item.status === "uploaded"}
                    onChange={(event) =>
                      update(item.id, {
                        type: event.target.value as DocumentType,
                        tendererId: "",
                        issue: undefined,
                      })
                    }
                    className="h-9 rounded-md border border-line-strong bg-panel px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                  >
                    <option value="">{t("selectType")}</option>
                    {documentTypeSchema.options.map((type) => (
                      <option key={type} value={type}>
                        {types(type)}
                      </option>
                    ))}
                  </select>
                </label>
                {item.type === "priced_boq" && (
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted-ink">
                    {t("tenderer")}
                    <select
                      value={item.tendererId}
                      disabled={busy || item.status === "uploaded"}
                      onChange={(event) =>
                        update(item.id, {
                          tendererId: event.target.value,
                          issue: undefined,
                        })
                      }
                      className="h-9 rounded-md border border-line-strong bg-panel px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                    >
                      <option value="">{t("selectTenderer")}</option>
                      {tenderers.map((tenderer) => (
                        <option key={tenderer.id} value={tenderer.id}>
                          {tenderer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {item.issue && (
                <p role="alert" className="mt-2 text-xs text-risk">
                  {issueText[item.issue]}
                </p>
              )}
              {item.status === "failed" && (
                <p role="alert" className="mt-2 text-xs text-risk">
                  {t("uploadFailed")}
                </p>
              )}
              {item.status === "uploading" && (
                <div className="mt-3">
                  <progress
                    max={100}
                    value={item.pct}
                    aria-label={`${item.file.name}: ${t("uploading", { pct: item.pct })}`}
                    className="h-2 w-full accent-clay-700"
                  />
                  <p className="num text-right text-xs text-muted-ink">
                    {t("uploading", { pct: item.pct })}
                  </p>
                </div>
              )}
              {item.status === "uploaded" && (
                <p className="mt-2 text-xs text-tolerance">{t("uploaded")}</p>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        className="mt-4"
        disabled={busy || !items.some((item) => item.status !== "uploaded")}
        onClick={() => void submit()}
      >
        {t("uploadSelected")}
      </Button>
    </section>
  );
}
