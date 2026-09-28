import { z } from "zod";
import { documentTypeSchema, type DocumentType } from "@/schemas";

const selectionSchema = z
  .object({
    size: z.number().positive(),
    type: documentTypeSchema,
    tendererId: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "priced_boq" && !value.tendererId)
      context.addIssue({
        code: "custom",
        path: ["tendererId"],
        message: "required",
      });
  });
export type UploadSelection = {
  file: File;
  type: DocumentType;
  tendererId?: string;
};
export type UploadIssue = "file" | "type" | "tenderer";
export function validateUploadSelection(
  file: File,
  type: string,
  tendererId: string,
): UploadIssue | null {
  const result = selectionSchema.safeParse({
    size: file.size,
    type,
    tendererId: tendererId || undefined,
  });
  if (result.success) return null;
  const path = result.error.issues[0]?.path[0];
  return path === "size" ? "file" : path === "tendererId" ? "tenderer" : "type";
}
