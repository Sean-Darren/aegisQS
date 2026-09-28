import { createFixtures, FIXTURE_TIME } from "./fixtures/data";
import { users } from "./fixtures/users";
import {
  auditEventSchema,
  type AuditEvent,
  type Role,
  type WsEvent,
} from "@/schemas";
export const db = createFixtures();
export const signedDocumentIds = new Set<string>();
export const signedFlagIds = new Set<string>();
export const uploadedFiles = new Map<string, Blob>();
let currentRole: Role = "senior_qs";
let sequence = 0;
const cleanups = new Set<() => void>();
const listeners = new Map<string, Set<(event: WsEvent) => void>>();
export function currentUser() {
  return users.find((user) => user.role === currentRole)!;
}
// Dev/test control only, deliberately not an invented REST endpoint or auth token.
export function setMockRole(role: Role) {
  currentRole = role;
}
export function nextId(prefix: string) {
  return `${prefix}-mock-${++sequence}`;
}
export function now() {
  return new Date(
    Date.parse(FIXTURE_TIME) + 200000 + sequence * 1000,
  ).toISOString();
}
export function registerCleanup(cleanup: () => void) {
  cleanups.add(cleanup);
  return () => cleanups.delete(cleanup);
}
export function subscribe(
  projectId: string,
  listener: (event: WsEvent) => void,
) {
  let subscribers = listeners.get(projectId);
  if (!subscribers) {
    subscribers = new Set();
    listeners.set(projectId, subscribers);
  }
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) listeners.delete(projectId);
  };
}
export function publish(projectId: string, event: WsEvent) {
  listeners.get(projectId)?.forEach((listener) => listener(event));
}
export function audit(
  action: string,
  entityType: AuditEvent["entityType"],
  entityId: string,
  details?: Record<string, unknown>,
) {
  const actor = currentUser();
  const id = nextId("A");
  db.auditEvents.push(
    auditEventSchema.parse({
      id,
      at: now(),
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      details,
    }),
  );
}
export function resetMockState() {
  for (const cleanup of cleanups) cleanup();
  cleanups.clear();
  listeners.clear();
  uploadedFiles.clear();
  signedFlagIds.clear();
  signedDocumentIds.clear();
  Object.assign(db, createFixtures());
  currentRole = "senior_qs";
  sequence = 0;
}
