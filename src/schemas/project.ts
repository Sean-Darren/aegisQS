import { z } from "zod";
import { isoDateSchema } from "./enums";
export const buildingTypeSchema = z.enum([
  "residential",
  "apartment",
  "commercial",
  "office",
  "hotel",
  "retail",
  "industrial",
  "institutional",
  "mixedUse",
  "other",
]);
export const buildingTypes = buildingTypeSchema.options;
export const projectSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  location: z.string().optional(),
  buildingType: buildingTypeSchema.optional(),
  createdAt: isoDateSchema,
  memberIds: z.array(z.string()),
});
export type Project = z.infer<typeof projectSchema>;
export type BuildingType = z.infer<typeof buildingTypeSchema>;
