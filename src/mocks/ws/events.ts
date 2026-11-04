import { wsEventSchema, type WsEvent } from "@/schemas";
type Listener = (projectId: string, event: WsEvent) => void;
const listeners = new Set<Listener>();
const timers = new Set<ReturnType<typeof setTimeout>>();
export function emit(projectId: string, event: WsEvent) {
  const parsed = wsEventSchema.parse(event);
  for (const listener of listeners) listener(projectId, parsed);
}
export function listen(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function schedule(callback: () => void, ms: number) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    callback();
  }, ms);
  timers.add(timer);
}
export function resetJobs() {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
}
