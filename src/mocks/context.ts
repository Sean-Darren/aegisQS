import * as store from "./store";
import { emit, schedule } from "./ws/events";
import { startComparison } from "./ws/simulation";
import type { DomainContext } from "@/lib/domain/context";
const liveState = new Proxy({} as DomainContext["state"], {
  get: (_, key) => Reflect.get(store.state, key),
  set: (_, key, value) => Reflect.set(store.state, key, value),
});
export const mockContext: DomainContext = {
  state: liveState,
  currentUser: store.currentUser,
  now: store.now,
  nextId: store.nextId,
  audit: store.audit,
  uploadedFiles: store.uploadedFiles,
  emit,
  schedule,
  startComparison: (...args) => startComparison(...args),
};
