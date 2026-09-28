import { http } from "msw";
import { z } from "zod";
import * as s from "@/schemas";
import { db, currentUser } from "../store";
import { json, allowed, projectGuard, paginate, failure } from "./shared";
const base = "*/api/v1";
export const projectHandlers = [
  http.get(`${base}/me`, () => json(s.userSchema, currentUser())),
  http.get(
    `${base}/projects`,
    () =>
      allowed("project.view") ?? json(z.array(s.projectSchema), db.projects),
  ),
  http.get(
    `${base}/projects/:projectId`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(
        s.projectSchema,
        db.projects.find((p) => p.id === params.projectId),
      ),
  ),
  http.get(
    `${base}/projects/:projectId/tenderers`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(
        z.array(s.tendererSchema),
        db.tenderers.filter((t) => t.projectId === params.projectId),
      ),
  ),
  http.get(
    `${base}/projects/:projectId/bids`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(
        z.array(s.bidSchema),
        db.bids.filter((b) => b.projectId === params.projectId),
      ),
  ),
  http.get(
    `${base}/projects/:projectId/kpis`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(s.projectKpisSchema, db.kpis),
  ),
  http.get(
    `${base}/projects/:projectId/scores`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(
        z.array(s.complianceScoreSchema),
        db.scores.filter((s) => s.projectId === params.projectId),
      ),
  ),
  http.get(
    `${base}/projects/:projectId/price-distribution`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(s.priceDistributionSchema, db.priceDistribution),
  ),
  http.get(
    `${base}/projects/:projectId/scope-gaps`,
    ({ params }) =>
      projectGuard(String(params.projectId)) ??
      json(
        z.array(s.scopeGapSchema),
        db.scopeGaps.filter((g) => g.projectId === params.projectId),
      ),
  ),
  http.get(`${base}/projects/:projectId/rate-grid`, ({ params, request }) => {
    const denied = projectGuard(String(params.projectId));
    if (denied) return denied;
    const query = new URL(request.url).searchParams;
    const trade = query.get("trade") || undefined;
    const flaggedOnly = query.get("flaggedOnly");
    if (flaggedOnly && !["true", "false"].includes(flaggedOnly))
      return failure(
        400,
        "INVALID_QUERY",
        "flaggedOnly must be true or false.",
      );
    const rows = db.rows.filter(
      (row) =>
        (!trade || row.trade === trade) &&
        (flaggedOnly !== "true" ||
          Object.values(row.rates).some((rate) => rate.flagId)),
    );
    const page = paginate(
      rows,
      query.get("cursor"),
      `rates:${params.projectId}:${trade ?? ""}:${flaggedOnly === "true"}`,
    );
    return page
      ? json(s.rateGridPageSchema, {
          rows: page.items,
          totalRows: rows.length,
          nextCursor: page.nextCursor,
        })
      : failure(
          400,
          "INVALID_CURSOR",
          "Cursor is invalid for this rate-grid query.",
        );
  }),
  http.get(
    `${base}/projects/:projectId/audit-events`,
    ({ params, request }) => {
      const denied = projectGuard(String(params.projectId));
      if (denied) return denied;
      const page = paginate(
        db.auditEvents,
        new URL(request.url).searchParams.get("cursor"),
        `audit:${params.projectId}`,
      );
      return page
        ? json(
            z.array(s.auditEventSchema),
            page.items,
            200,
            page.nextCursor ? { "X-Next-Cursor": page.nextCursor } : undefined,
          )
        : failure(
            400,
            "INVALID_CURSOR",
            "Cursor is invalid for this audit query.",
          );
    },
  ),
];
