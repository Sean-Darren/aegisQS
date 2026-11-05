import { z } from "zod";
import { isoDateSchema } from "./enums";
export const documentCategorySchema = z.enum([
  "contract",
  "drawing",
  "site_record",
  "financial",
  "correspondence",
]);
export const disciplineSchema = z.enum([
  "architectural",
  "structural",
  "building_services",
  "civil",
  "other",
]);
export const hubDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  category: documentCategorySchema,
  docNumber: z.string().min(1),
  title: z.string().min(1),
  discipline: disciplineSchema.optional(),
  currentVersionId: z.string().optional(),
  versionCount: z.number().int().nonnegative(),
  hasConflict: z.boolean(),
  tags: z.array(z.string()),
  updatedAt: isoDateSchema,
});
export const documentVersionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  label: z.string().min(1),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().positive().optional(),
  status: z.enum(["current", "superseded", "conflict", "processing"]),
  issuedDate: isoDateSchema.optional(),
  notes: z.string().optional(),
  uploadedBy: z.string(),
  uploadedAt: isoDateSchema,
});
export const versionConflictSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  kind: z.enum([
    "duplicate_file",
    "same_label_different_file",
    "out_of_order_label",
  ]),
  versionIds: z.array(z.string()).min(2),
  detectedAt: isoDateSchema,
  resolution: z
    .object({
      keptVersionId: z.string(),
      by: z.string(),
      at: isoDateSchema,
      reason: z.string().min(1),
    })
    .optional(),
});
const linkedEntity = z.object({
  type: z.enum([
    "document_version",
    "change",
    "variation",
    "boq_item",
    "workbook_version",
    "material",
  ]),
  id: z.string(),
});
export const entityLinkSchema = z.object({
  from: linkedEntity,
  to: linkedEntity,
});
export type DocumentCategory = z.infer<typeof documentCategorySchema>;
export type Discipline = z.infer<typeof disciplineSchema>;
export type HubDocument = z.infer<typeof hubDocumentSchema>;
export type DocumentVersion = z.infer<typeof documentVersionSchema>;
export type VersionConflict = z.infer<typeof versionConflictSchema>;
export type EntityLink = z.infer<typeof entityLinkSchema>;
