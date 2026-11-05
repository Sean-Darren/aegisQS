import type * as s from "@/schemas";
import type { DomainContext, DomainState } from "@/lib/domain/context";
import { createStartComparison } from "@/lib/domain/comparison";
import type { RecordRow } from "./records";
export function createPersistentContext(state: DomainState, user: s.User) {
  const events: RecordRow[] = [];
  const ctx: DomainContext = {
    state,
    currentUser: () => user,
    now: () => new Date().toISOString(),
    nextId: (p) => `${p}-${crypto.randomUUID()}`,
    uploadedFiles: new Map(),
    audit: (action, entityType, entityId, summary, details, actor = user) =>
      state.auditEvents.push({
        id: `AE-${crypto.randomUUID()}`,
        at: new Date().toISOString(),
        actorId: actor.id,
        actorRole: actor.role,
        action,
        entityType,
        entityId,
        summary,
        details,
      }),
    emit: (projectId, event) =>
      events.push({
        table: "project_events",
        id: `${Date.now()}-${crypto.randomUUID()}`,
        projectId,
        data: { event, at: new Date().toISOString() },
      }),
    // Tasks are recovered by the durable worker from persisted entity status/timestamps.
    schedule: () => {},
    startComparison: () => {
      throw new Error("Comparison context not initialized");
    },
  };
  ctx.startComparison = createStartComparison(ctx);
  return { ctx, events };
}
