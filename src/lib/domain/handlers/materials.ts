import { z } from "zod";
import * as s from "@/schemas";
import { calculateAdvice } from "../procurement";
import type { DomainContext } from "../context";
import { createHelpers } from "./shared";
export function createMaterialsHandlers(ctx: DomainContext) {
  const { state, currentUser, now, nextId, audit } = ctx;
  const { route, reply, requireProject, requirePermission, find } =
    createHelpers(ctx);
  return [
    route("get", "/materials", ({ request }) => {
      requirePermission("project.view");
      const q = new URL(request.url).searchParams;
      return reply(
        z.array(s.materialSchema),
        state.materials.filter(
          (m) =>
            (!q.get("category") || m.category === q.get("category")) &&
            `${m.name} ${m.code}`
              .toLowerCase()
              .includes((q.get("q") ?? "").toLowerCase()),
        ),
      );
    }),
    route("get", "/materials/:materialId/forecast", ({ params }) => {
      requirePermission("project.view");
      find(state.materials, String(params.materialId));
      return reply(
        s.priceForecastSchema,
        state.forecasts.find((f) => f.materialId === String(params.materialId)),
      );
    }),
    route("get", "/projects/:projectId/material-needs", ({ params }) => {
      const id = String(params.projectId);
      requireProject(id);
      return reply(
        z.array(s.projectMaterialNeedSchema),
        state.materialNeeds.filter((n) => n.projectId === id),
      );
    }),
    route("get", "/projects/:projectId/procurement", ({ params }) => {
      const id = String(params.projectId);
      requireProject(id);
      return reply(
        z.array(s.procurementAdviceSchema),
        state.procurement.filter((p) => p.projectId === id),
      );
    }),
    route(
      "post",
      "/projects/:projectId/procurement",
      async ({ params, request }) => {
        requirePermission("procurement.plan");
        const projectId = String(params.projectId);
        requireProject(projectId);
        const body = s.procurementAdviceSchema
          .pick({
            materialId: true,
            quantity: true,
            neededBy: true,
            leadTimeWeeks: true,
          })
          .parse(await request.json());
        const material = find(state.materials, body.materialId),
          forecast = state.forecasts.find((f) => f.materialId === material.id)!;
        const advice = calculateAdvice({
          ...body,
          id: nextId("PA"),
          projectId,
          material,
          forecast,
          createdBy: currentUser().id,
          createdAt: now(),
        });
        state.procurement.push(advice);
        audit(
          "procurement.created",
          "procurement",
          advice.id,
          "Procurement advice saved",
          { materialId: material.id },
        );
        return reply(s.procurementAdviceSchema, advice, 201);
      },
    ),
  ];
}
