"use client";
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
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <h3 className="font-semibold">{file.name}</h3>
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
          <select {...register("category")} className={inputStyle}>
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
            readOnly={!!fixedDocument}
            className={inputStyle}
          />
        </label>
        <label>
          {t("title")}
          <input {...register("title")} className={inputStyle} />
        </label>
        <label>
          {t("revision")}
          <input {...register("label")} className={inputStyle} />
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
          <select {...register("discipline")} className={inputStyle}>
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
