import { http } from "msw";
import { z } from "zod";
import {
  flagSchema,
  flagFiltersSchema,
  dispositionInputSchema,
  type FlagFilters,
  type Flag,
} from "@/schemas";
import { db, currentUser, now, audit, signedFlagIds } from "../store";
import { json, projectGuard, allowed, failure, input } from "./shared";
export function matchesFlag(flag: Flag, filters: FlagFilters) {
  return Object.entries(filters).every(
    ([key, value]) =>
      value === undefined || flag[key as keyof FlagFilters] === value,
  );
}
export const flagHandlers = [
  http.get("*/api/v1/projects/:projectId/flags", ({ params, request }) => {
    const denied = projectGuard(String(params.projectId));
    if (denied) return denied;
    const parsed = flagFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success)
      return failure(400, "INVALID_QUERY", "Flag filters are invalid.");
    return json(
      z.array(flagSchema),
      db.flags.filter(
        (flag) =>
          flag.projectId === params.projectId && matchesFlag(flag, parsed.data),
      ),
    );
  }),
  http.get("*/api/v1/flags/:flagId", ({ params }) => {
    const denied = allowed("project.view");
    if (denied) return denied;
    const flag = db.flags.find((flag) => flag.id === params.flagId);
    return flag
      ? json(flagSchema, flag)
      : failure(404, "NOT_FOUND", "Flag not found.");
  }),
  ...(["proposal", "decision"] as const).map((kind) =>
    http.post(`*/api/v1/flags/:flagId/${kind}`, async ({ params, request }) => {
      const denied = allowed(
        kind === "proposal" ? "flag.propose" : "flag.finalize",
      );
      if (denied) return denied;
      const flag = db.flags.find((flag) => flag.id === params.flagId);
      if (!flag) return failure(404, "NOT_FOUND", "Flag not found.");
      const parsed = await input(request, dispositionInputSchema);
      if (!parsed.success)
        return failure(
          400,
          "INVALID_BODY",
          "A valid action and a reason of at least 10 characters are required.",
        );
      if (kind === "proposal" && flag.decision)
        return failure(
          409,
          "FINALIZED",
          "A finalized flag cannot receive a new proposal.",
        );
      if (signedFlagIds.has(flag.id))
        return failure(
          409,
          "VERSION_LOCKED",
          "The signed assessment is version-locked.",
        );
      const decision = { ...parsed.data, by: currentUser().id, at: now() };
      if (kind === "proposal") {
        flag.proposal = decision;
        flag.status = "proposed";
      } else {
        flag.decision = decision;
        flag.status = (
          {
            accept: "accepted",
            dismiss: "dismissed",
            escalate: "escalated",
          } as const
        )[decision.action];
      }
      audit(`flag.${kind}`, "flag", flag.id, {
        action: decision.action,
        reason: decision.reason,
      });
      return json(flagSchema, flag);
    }),
  ),
];
