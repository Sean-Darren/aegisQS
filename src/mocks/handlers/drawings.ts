import { z } from "zod";
import * as s from "@/schemas";
import { state, audit, now, currentUser } from "../store";
import {
  route,
  reply,
  requireProject,
  requirePermission,
  document,
  find,
  MockError,
} from "./shared";
import { startComparison } from "../ws/simulation";
export const drawingHandlers = [
  route("get", "/projects/:projectId/drawings", ({ params }) => {
    const id = String(params.projectId);
    requireProject(id);
    return reply(
      z.array(s.drawingRegisterEntrySchema),
      state.documents
        .filter((d) => d.projectId === id && d.category === "drawing")
        .map((document) => ({
          document,
          latestComparison: state.comparisons
            .filter((c) => c.documentId === document.id)
            .at(-1),
        })),
    );
  }),
  route(
    "post",
    "/projects/:projectId/comparisons",
    async ({ params, request }) => {
      requirePermission("comparison.run");
      const id = String(params.projectId);
      requireProject(id);
      const body = z
        .object({
          documentId: z.string(),
          baseVersionId: z.string(),
          targetVersionId: z.string(),
        })
        .parse(await request.json());
      const doc = document(body.documentId);
      if (doc.projectId !== id || doc.category !== "drawing")
        throw new MockError(400, "Choose a drawing in this project.");
      const base = find(state.versions, body.baseVersionId),
        target = find(state.versions, body.targetVersionId);
      if (
        base.documentId !== doc.id ||
        target.documentId !== doc.id ||
        base.id === target.id
      )
        throw new MockError(
          400,
          "Choose two different revisions of the same drawing.",
        );
      return reply(
        s.drawingComparisonSchema,
        startComparison(id, doc.id, base.id, target.id),
        201,
      );
    },
  ),
  route("get", "/comparisons/:comparisonId", ({ params }) => {
    const c = find(state.comparisons, String(params.comparisonId));
    requireProject(c.projectId);
    return reply(s.drawingComparisonSchema, c);
  }),
  route(
    "patch",
    "/comparisons/:comparisonId/alignment",
    async ({ params, request }) => {
      requirePermission("comparison.run");
      const c = find(state.comparisons, String(params.comparisonId));
      requireProject(c.projectId);
      const body = s.drawingComparisonSchema.shape.alignment
        .pick({ dx: true, dy: true, scale: true, rotationDeg: true })
        .parse(await request.json());
      c.alignment = { ...c.alignment, ...body, method: "manual" };
      audit(
        "comparison.alignment_updated",
        "comparison",
        c.id,
        "Manual alignment updated",
        body,
      );
      return reply(s.drawingComparisonSchema, c);
    },
  ),
  route("get", "/comparisons/:comparisonId/changes", ({ params, request }) => {
    const c = find(state.comparisons, String(params.comparisonId));
    requireProject(c.projectId);
    const q = new URL(request.url).searchParams;
    return reply(
      z.array(s.drawingChangeSchema),
      state.changes.filter(
        (ch) =>
          ch.comparisonId === c.id &&
          (!q.get("kind") || ch.kind === q.get("kind")) &&
          (!q.get("status") || ch.status === q.get("status")),
      ),
    );
  }),
  route("patch", "/changes/:changeId", async ({ params, request }) => {
    requirePermission("change.review");
    const change = find(state.changes, String(params.changeId));
    const c = find(state.comparisons, change.comparisonId);
    requireProject(c.projectId);
    const body = z
      .object({ status: s.changeStatusSchema, note: z.string().optional() })
      .parse(await request.json());
    change.status = body.status;
    change.review = { by: currentUser().id, at: now(), note: body.note };
    audit(
      `change.marked_${body.status}`,
      "change",
      change.id,
      `Change ${change.number} review updated`,
      { note: body.note },
    );
    return reply(s.drawingChangeSchema, change);
  }),
];
