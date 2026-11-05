import { z } from "zod";
import * as s from "@/schemas";
import { calculateAdvice } from "../procurement";
import type { DomainContext } from "../context";
import { createHelpers, MockError } from "./shared";
function inferMaterialCategory(
  description: string,
  unit: string,
): s.Material["category"] {
  const text = `${description} ${unit}`.toLowerCase();
  if (/\b(steel|rebar|metal|aluminium|aluminum)\b/.test(text))
    return "steel";
  if (/\b(concrete|cement|mortar)\b/.test(text))
    return text.includes("cement") || text.includes("mortar")
      ? "cement"
      : "concrete";
  if (/\b(aggregate|stone|sand|gravel)\b/.test(text)) return "aggregate";
  if (/\b(timber|wood|plywood|formwork)\b/.test(text)) return "timber";
  if (/\b(copper|cable|wire)\b/.test(text)) return "copper";
  if (/\b(glass|glazing|window)\b/.test(text)) return "glass";
  if (/\b(waterproof|membrane)\b/.test(text)) return "waterproofing";
  return "other";
}
export function createMaterialsHandlers(ctx: DomainContext) {
  const { state, currentUser, now, nextId, audit, uploadedFiles } = ctx;
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
      "/projects/:projectId/material-needs/extract/:documentId",
      async ({ params }) => {
        requirePermission("procurement.plan");
        const projectId = String(params.projectId);
        requireProject(projectId);

        const documentId = String(params.documentId);
        const doc = find(state.documents, documentId);
        if (doc.projectId !== projectId)
          throw new MockError(
            400,
            "Choose a saved artifact from this project.",
          );
        if (doc.category !== "site_record")
          throw new MockError(
            400,
            "Choose a saved BIM analysis site record.",
          );
        const versionId = doc.currentVersionId;
        if (!versionId)
          throw new MockError(400, "The saved artifact has no current file.");
        const bytes = uploadedFiles.get(versionId);
        if (!bytes)
          throw new MockError(500, "The saved artifact file is not available.");

        let payload: { result: s.BimResult };
        try {
          payload = z
            .object({ result: s.bimResultSchema })
            .parse(JSON.parse(new TextDecoder().decode(bytes)));
        } catch {
          throw new MockError(
            400,
            "Choose a saved BIM analysis artifact.",
          );
        }
        const boqItems = payload.result.boq ?? [];

        // Keep BOQ, variation, and manual needs. Rebuild only site-record needs.
        state.materialNeeds = state.materialNeeds.filter(
          (n) => n.projectId !== projectId || n.source !== "site_record",
        );

        const period = now().slice(0, 7);
        const grouped = new Map<
          string,
          {
            code: string;
            name: string;
            unit: string;
            category: s.Material["category"];
            quantity: number;
            rate: number;
          }
        >();

        for (const item of boqItems) {
          const code =
            item.material_code ||
            item.price_book_item_code ||
            item.item_id ||
            nextId("SITE");
          const quantity = item.quantity ?? 0;
          if (quantity <= 0) continue;
          const rate =
            item.rate ??
            item.rate_applied ??
            (item.total_price && quantity ? item.total_price / quantity : 0);
          const name =
            item.description ||
            item.bim_element ||
            item.material_family ||
            item.trade ||
            code;
          const unit = item.unit?.trim() || "No.";
          const entry = grouped.get(code) ?? {
            code,
            name,
            unit,
            category: inferMaterialCategory(name, unit),
            quantity: 0,
            rate,
          };
          entry.quantity += quantity;
          if (!entry.rate && rate) entry.rate = rate;
          grouped.set(code, entry);
        }

        const extracted: s.ProjectMaterialNeed[] = [];
        for (const group of grouped.values()) {
          let material = state.materials.find((m) => m.code === group.code);
          if (!material) {
            material = {
              id: nextId("SITE"),
              code: group.code,
              name: group.name,
              unit: group.unit,
              category: group.category,
              source: `BIM site record · ${doc.docNumber}`,
              latestPrice: group.rate,
              latestPeriod: period,
              change3mPct: 0,
              trend: "stable",
            };
            state.materials.push(material);
          }
          if (
            !state.links.some(
              (l) =>
                l.from.type === "material" &&
                l.from.id === material!.id &&
                l.to.type === "document_version" &&
                l.to.id === versionId,
            )
          ) {
            state.links.push({
              from: { type: "material", id: material!.id },
              to: { type: "document_version", id: versionId },
            });
          }
          const exposure = Math.round(group.quantity * group.rate * 100) / 100;
          extracted.push({
            projectId,
            materialId: material!.id,
            quantity: group.quantity,
            source: "site_record",
            sourceRefs: [documentId],
            exposureHKD: {
              p10: exposure,
              p50: exposure,
              p90: exposure,
            },
          });
        }

        state.materialNeeds.push(...extracted);
        audit(
          "procurement.materials_extracted",
          "procurement",
          projectId,
          "Extracted project material needs from a saved BIM site record",
          { documentId, count: extracted.length },
        );
        return reply(z.array(s.projectMaterialNeedSchema), extracted, 201);
      },
    ),
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
