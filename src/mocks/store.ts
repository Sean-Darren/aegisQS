import type { Role, AuditEvent, User } from "@/schemas";
import { users } from "./fixtures/users";
import * as fixtures from "./fixtures/data";
import { resetJobs } from "./ws/events";
import type { ParsedWorkbook } from "./workbook-engine";
function initial() {
  return structuredClone({
    projects: [fixtures.project],
    documents: fixtures.documents,
    versions: fixtures.versions,
    conflicts: fixtures.conflicts,
    comparisons: fixtures.comparisons,
    changes: fixtures.changes,
    variations: fixtures.variations,
    workbooks: fixtures.workbooks,
    workbookVersions: fixtures.workbookVersions,
    checks: fixtures.checks,
    items: fixtures.boqItems,
    materials: fixtures.materials,
    forecasts: fixtures.forecasts,
    procurement: fixtures.procurement,
    materialNeeds: fixtures.materialNeeds,
    links: fixtures.links,
    auditEvents: fixtures.auditEvents,
    parsed: {
      "WV-1": fixtures.parsedWorkbooks["boq-v1"],
      "WV-2": fixtures.parsedWorkbooks["boq-v2"],
    } as Record<string, ParsedWorkbook>,
    filePaths: fixtures.filePaths,
  });
}
export let state = initial();
export const uploadedFiles = new Map<string, ArrayBuffer>();
let role: Role = "senior_qs";
let sequence = 1000;
export function setMockRole(next: Role) {
  role = next;
}
export function currentUser() {
  return users.find((u) => u.role === role)!;
}
export function nextId(prefix: string) {
  return `${prefix}-${++sequence}`;
}
export function now() {
  return new Date(
    Date.parse(fixtures.fixtureTime) + sequence++ * 1000,
  ).toISOString();
}
export function audit(
  action: string,
  entityType: AuditEvent["entityType"],
  entityId: string,
  summary: string,
  details?: Record<string, unknown>,
  user: User = currentUser(),
) {
  state.auditEvents.push({
    id: nextId("AE"),
    at: now(),
    actorId: user.id,
    actorRole: user.role,
    action,
    entityType,
    entityId,
    summary,
    details,
  });
}
export function resetStore() {
  resetJobs();
  state = initial();
  uploadedFiles.clear();
  role = "senior_qs";
  sequence = 1000;
}
export const resetMockState = resetStore;
