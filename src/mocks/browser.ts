import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
export const worker = setupWorker(...handlers);
let starting: ReturnType<typeof worker.start> | undefined;
export function startMocking() {
  return (starting ??= worker.start({ onUnhandledRequest: "bypass" }));
}
