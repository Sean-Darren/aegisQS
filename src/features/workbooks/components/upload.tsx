"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Dropzone, Button, ErrorState } from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import { resources } from "@/lib/api";
import { useRouter } from "@/i18n/navigation";
import type { Workbook, WorkbookKind } from "@/schemas";
export function WorkbookUpload({
  projectId,
  workbook,
}: {
  projectId: string;
  workbook?: Workbook;
}) {
  const t = useTranslations("Workbooks");
  const client = useQueryClient();
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WorkbookKind>("boq");
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState(false);
  async function upload() {
    if (!file) return;
    setProgress(0);
    setError(false);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name || file.name);
      form.set("kind", kind);
      const options = { onProgress: setProgress };
      let id = workbook?.id,
        versionId: string | undefined;
      if (workbook) {
        versionId = (
          await resources.uploadWorkbookVersion(workbook.id, form, options)
        ).id;
      } else {
        const created = await resources.uploadWorkbook(
          projectId,
          form,
          options,
        );
        id = created.id;
        versionId = created.currentVersionId;
      }
      await client.invalidateQueries();
      setFile(undefined);
      router.push(
        `/projects/${projectId}/workbooks/${id}?version=${versionId}${workbook ? "" : "&mapping=1"}`,
      );
    } catch {
      setError(true);
    } finally {
      setProgress(undefined);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-line bg-panel p-4">
      <Dropzone
        label={t("upload")}
        accept={{
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            ".xlsx",
          ],
          "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
        }}
        multiple={false}
        disabled={progress !== undefined}
        onFiles={(files) => {
          setFile(files[0]);
          setName(files[0].name);
        }}
      />
      {file && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void upload();
          }}
          className="space-y-3"
        >
          <p>{file.name}</p>
          {!workbook && (
            <>
              <label>
                {t("name")}
                <input
                  className={inputStyle}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t("kind")}
                <select
                  className={inputStyle}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as WorkbookKind)}
                >
                  {["boq", "cost_plan", "valuation", "other"].map((k) => (
                    <option key={k} value={k}>
                      {t(`kinds.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {progress !== undefined && (
            <div role="status" aria-live="polite">
              {t("uploading", { progress })}
              <progress value={progress} max={100} className="w-full" />
            </div>
          )}
          <Button type="submit" disabled={progress !== undefined}>
            {t("uploadFile")}
          </Button>
        </form>
      )}
      {error && <ErrorState message={t("error")} />}
    </section>
  );
}
