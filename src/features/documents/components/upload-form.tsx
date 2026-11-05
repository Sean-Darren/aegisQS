"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import {
  documentCategorySchema,
  disciplineSchema,
  type HubDocument,
  type DocumentVersion,
} from "@/schemas";
import { Button } from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
export const uploadFieldsSchema = z.object({
  category: documentCategorySchema,
  docNumber: z.string().trim().min(1),
  title: z.string().trim().min(1),
  label: z.string().trim().min(1),
  issuedDate: z.union([z.literal(""), z.iso.date()]),
  discipline: z.union([z.literal(""), disciplineSchema]),
});
export type UploadFields = z.infer<typeof uploadFieldsSchema>;
export function UploadForm({
  file,
  documents,
  versions,
  pending,
  onSubmit,
  fixedDocument,
}: {
  file: File;
  documents: HubDocument[];
  versions: DocumentVersion[];
  pending: boolean;
  onSubmit: (fields: UploadFields) => Promise<void>;
  fixedDocument?: HubDocument;
}) {
  const t = useTranslations("Hub");
  const [documentId, setDocumentId] = useState(fixedDocument?.id ?? "");
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<UploadFields>({
    resolver: zodResolver(uploadFieldsSchema),
    defaultValues: {
      category: fixedDocument?.category ?? "drawing",
      docNumber: fixedDocument?.docNumber ?? "",
      title: fixedDocument?.title ?? file.name,
      label: "",
      issuedDate: "",
      discipline: fixedDocument?.discipline ?? "",
    },
  });
  const number = useWatch({ control, name: "docNumber" });
  const existing = documents.find(
    (d) => d.docNumber.trim().toLowerCase() === number.trim().toLowerCase(),
  );
  const current = versions.find((v) => v.id === existing?.currentVersionId);
  const selectedDocument = documents.find((d) => d.id === documentId);
  const locked = !!fixedDocument || !!selectedDocument;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <h3 className="font-semibold">{file.name}</h3>
      {!fixedDocument && documents.length > 0 && (
        <label>
          {t("document")}
          <select
            className={inputStyle}
            value={documentId}
            onChange={(event) => {
              const next = event.target.value;
              setDocumentId(next);
              const match = documents.find((d) => d.id === next);
              if (match) {
                setValue("docNumber", match.docNumber);
                setValue("title", match.title);
                setValue("category", match.category);
                setValue("discipline", match.discipline ?? "");
              } else {
                setValue("docNumber", "");
                setValue("title", file.name);
                setValue("category", "drawing");
                setValue("discipline", "");
              }
            }}
          >
            <option value="">{t("newDocument")}</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.docNumber} · {doc.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {existing && (
        <p role="status" className="rounded-md bg-stone-50 p-3 text-sm">
          {t("existing", {
            number: existing.docNumber,
            revision: current?.label ?? "…",
          })}
        </p>
      )}
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <label>
          {t("category")}
          <select
            {...register("category")}
            disabled={locked}
            className={inputStyle}
          >
            {documentCategorySchema.options.map((v) => (
              <option key={v} value={v}>
                {t(`categories.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("number")}
          <input
            {...register("docNumber", {
              onChange: (event) => {
                const match = documents.find(
                  (d) =>
                    d.docNumber.toLowerCase() ===
                    event.target.value.trim().toLowerCase(),
                );
                if (match) {
                  setValue("title", match.title);
                  setValue("category", match.category);
                  setValue("discipline", match.discipline ?? "");
                }
              },
            })}
            readOnly={locked}
            className={inputStyle}
          />
        </label>
        <label>
          {t("title")}
          <input
            {...register("title")}
            readOnly={locked}
            className={inputStyle}
          />
        </label>
        <label>
          {t("revision")}
          <input
            {...register("label")}
            placeholder={t("revisionPlaceholder")}
            className={inputStyle}
          />
        </label>
        <label>
          {t("issued")}
          <input
            type="date"
            {...register("issuedDate")}
            className={inputStyle}
          />
        </label>
        <label>
          {t("discipline")}
          <select
            {...register("discipline")}
            disabled={locked}
            className={inputStyle}
          >
            <option value="">{t("notSpecified")}</option>
            {disciplineSchema.options.map((v) => (
              <option key={v} value={v}>
                {t(`disciplines.${v}`)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-risk">
          {t("validation")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("uploading") : t("uploadFile")}
      </Button>
    </form>
  );
}
