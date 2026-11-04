import { z } from "zod";
export const roleSchema = z.enum(["senior_qs", "qs", "viewer", "admin"]);
export const isoDateSchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }),
]);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const bboxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  })
  .refine(
    (b) => b.x + b.w <= 1 && b.y + b.h <= 1,
    "Bounding box must fit the page",
  );
export type Role = z.infer<typeof roleSchema>;
export type ISODate = z.infer<typeof isoDateSchema>;
export type Period = z.infer<typeof periodSchema>;
export type BBox = z.infer<typeof bboxSchema>;
