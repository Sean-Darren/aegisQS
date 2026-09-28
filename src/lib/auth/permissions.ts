import type { User } from "@/schemas/user";
export const PERMISSIONS = {
  "project.view": ["senior_qs", "junior_qs", "admin"],
  "document.upload": ["senior_qs", "junior_qs"],
  "analysis.run": ["senior_qs", "junior_qs"],
  "flag.comment": ["senior_qs", "junior_qs"],
  "flag.propose": ["senior_qs", "junior_qs"],
  "flag.finalize": ["senior_qs"],
  "report.sign": ["senior_qs"],
  "report.share": ["senior_qs"],
  "report.viewSigned": ["senior_qs", "junior_qs", "owner_viewer", "admin"],
  "admin.manage": ["admin"],
} as const;
export type Permission = keyof typeof PERMISSIONS;
// Resource-specific authorization remains the backend's responsibility.
export function can(
  user: Pick<User, "role"> | null | undefined,
  permission: Permission,
  resource?: { status?: string },
): boolean {
  const roles: readonly User["role"][] = PERMISSIONS[permission];
  if (!user || !roles.includes(user.role)) return false;
  if (
    permission === "report.viewSigned" &&
    resource?.status &&
    resource.status !== "signed"
  )
    return false;
  return true;
}
