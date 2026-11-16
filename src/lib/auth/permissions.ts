import type { User } from "@/schemas";
export const PERMISSIONS = {
  "project.view": ["senior_qs", "qs", "viewer", "admin"],
  "project.create": ["senior_qs", "admin"],
  "project.update": ["senior_qs", "admin"],
  "project.delete": ["senior_qs", "admin"],
  "document.upload": ["senior_qs", "qs"],
  "document.setCurrent": ["senior_qs"],
  "comparison.run": ["senior_qs", "qs"],
  "change.review": ["senior_qs", "qs"],
  "variation.raise": ["senior_qs", "qs"],
  "variation.editCost": ["senior_qs", "qs"],
  "variation.decide": ["senior_qs"],
  "workbook.upload": ["senior_qs", "qs"],
  "workbook.editMapping": ["senior_qs", "qs"],
  "workbook.resolveCheck": ["senior_qs", "qs"],
  "procurement.plan": ["senior_qs", "qs"],
  "admin.manage": ["admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;
export function can(
  user: Pick<User, "role"> | null | undefined,
  permission: Permission,
) {
  const roles: readonly string[] = PERMISSIONS[permission];
  return !!user && roles.includes(user.role);
}
