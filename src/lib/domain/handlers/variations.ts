import { variationRangeRule } from "@/lib/config/variation";
import { z } from "zod";
import * as s from "@/schemas";
import type { DomainContext } from "../context";
import { createHelpers } from "./shared";

/*
 * Simple OLS (ordinary least squares) regression for time-series trend.
 * Given (index, price) pairs, returns { slope, intercept } so that
 *   price ≈ intercept + slope * index
 */
function ols(series: { period: string; price: number }[]) {
  const n = series.length;
  if (n < 2) return { slope: 0, intercept: series[0]?.price ?? 0 };
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = series[i].price;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/*
 * Project a rate using OLS trend from historical forecast data.
 * Falls back to the latest p50 forecast if history is too short or flat.
 */
function olsProjectedRate(forecast: s.PriceForecast): number {
  const history = forecast.history;
  if (history.length < 3)
    return forecast.forecast[0]?.p50 ?? forecast.history.at(-1)?.price ?? 0;
  const { slope, intercept } = ols(history);
  const projectIndex = history.length + 6;
  const projected = intercept + slope * projectIndex;
  if (!Number.isFinite(projected) || projected <= 0)
    return forecast.forecast[0]?.p50 ?? history.at(-1)!.price;
  return projected;
}

/*
 * Match a change summary/text to the best material using keyword heuristics.
 */
const MATERIAL_KEYWORDS: Record<
  string,
  { keywords: string[]; unit: string }
> = {
  rebar: {
    keywords: [
      "rebar",
      "reinforcement",
      "reinforcing",
      "bar",
      "tendon",
    ],
    unit: "tonne",
  },
  "structural-steel": {
    keywords: [
      "steel",
      "structural steel",
      "beam",
      "column",
      "member",
      "framing",
      "metal",
      "girder",
      "truss",
    ],
    unit: "tonne",
  },
  concrete: {
    keywords: [
      "concrete",
      "slab",
      "foundation",
      "footing",
      "pile",
      "pier",
      "masonry",
      "block",
      "brick",
      "stone",
      "cement",
      "render",
      "screed",
    ],
    unit: "m³",
  },
  cement: {
    keywords: ["cement", "mortar", "grout"],
    unit: "tonne",
  },
  aggregate: {
    keywords: [
      "aggregate",
      "gravel",
      "sand",
      "fill",
      "sub-base",
      "ballast",
    ],
    unit: "tonne",
  },
  timber: {
    keywords: [
      "timber",
      "wood",
      "formwork",
      "plywood",
      "roof",
      "truss",
      "fascia",
      "trim",
      "joinery",
      "door",
      "window",
      "cladding",
      "plank",
      "deck",
    ],
    unit: "m²",
  },
  copper: {
    keywords: [
      "copper",
      "cable",
      "wire",
      "conduit",
      "electrical",
      "wiring",
      "lighting",
    ],
    unit: "tonne",
  },
  glass: {
    keywords: [
      "glass",
      "glazing",
      "curtain wall",
      "window",
      "glazed",
      "glaze",
      "fenestration",
      "skylight",
      "louvre",
    ],
    unit: "m²",
  },
  waterproofing: {
    keywords: [
      "waterproof",
      "membrane",
      "sealant",
      "seal",
      "damp",
      "tanking",
      "flashing",
    ],
    unit: "m²",
  },
  diesel: {
    keywords: ["diesel", "fuel", "petrol", "oil"],
    unit: "litre",
  },
};

function matchMaterial(
  summary: string,
  textBefore?: string,
  textAfter?: string,
): { materialId: string; unit: string } | undefined {
  const text = `${summary} ${textBefore ?? ""} ${textAfter ?? ""}`.toLowerCase();
  let best: { materialId: string; unit: string; score: number } | undefined;
  for (const [id, { keywords, unit }] of Object.entries(MATERIAL_KEYWORDS)) {
    const score = keywords.reduce(
      (s, kw) => s + (text.includes(kw) ? 1 : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score))
      best = { materialId: id, unit, score };
  }
  return best ? { materialId: best.materialId, unit: best.unit } : undefined;
}

function deriveQuantity(
  bbox: { w: number; h: number },
  confidence: number,
  unit: string,
): number {
  const area = bbox.w * bbox.h;
  const clamped = Math.max(0.01, Math.min(1, area));
  const factor = clamped * confidence;
  switch (unit) {
    case "m²":
      return Math.max(1, Math.round(factor * 300));
    case "m":
      return Math.max(1, Math.round(Math.sqrt(factor) * 80));
    case "m³":
    case "tonne":
      return Math.max(0.5, Math.round(factor * 15 * 10) / 10);
    case "litre":
      return Math.max(10, Math.round(factor * 500));
    default:
      return 1;
  }
}

function seedCostLines(
  ctx: { state: DomainContext["state"] },
  changes: s.DrawingChange[],
  seq: { value: number },
): {
  lines: s.CostLine[];
  indicativeCost: s.VariationEvent["indicativeCost"];
} {
  const { state } = ctx;
  const lines: s.CostLine[] = [];
  for (const change of changes) {
    const match = matchMaterial(
      change.summary,
      change.textBefore,
      change.textAfter,
    );
    const materialId = match?.materialId;
    const unit = match?.unit ?? "m²";
    const material = materialId
      ? state.materials.find((m) => m.id === materialId)
      : undefined;
    const forecast = materialId
      ? state.forecasts.find((f) => f.materialId === materialId)
      : undefined;

    const quantityDelta = deriveQuantity(change.bbox, change.confidence, unit);
    const rate = forecast
      ? Math.round(olsProjectedRate(forecast) * 100) / 100
      : (material?.latestPrice ?? 1000);
    const amount = Math.round(quantityDelta * rate * 100) / 100;

    const description =
      change.summary ||
      `${change.textBefore ?? "Previous"} → ${change.textAfter ?? "New"}`;
    const boqItemRef = `REV-△${change.number}`;

    lines.push({
      id: `cost-seed-${change.id}-${++seq.value}`,
      boqItemRef,
      description,
      unit,
      quantityDelta,
      rate,
      rateSource: forecast ? "forecast_adjusted" : "manual",
      amount,
      materialId,
    });
  }

  if (!lines.length) return { lines: [], indicativeCost: undefined };

  const total =
    Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
  const ends = [
    total * variationRangeRule.lowFactor,
    total * variationRangeRule.highFactor,
  ].sort((a, b) => a - b);

  return {
    lines,
    indicativeCost: {
      total,
      low: Math.round(ends[0] * 100) / 100,
      high: Math.round(ends[1] * 100) / 100,
      basis:
        "AI-seeded quantities × forecast-adjusted rates (OLS trend); indicative range for review.",
    },
  };
}

export function createVariationsHandlers(ctx: DomainContext) {
  const { state, currentUser, now, audit } = ctx;
  const { route, reply, requireProject, requirePermission, find, MockError } =
    createHelpers(ctx);
  function variation(id: string) {
    const v = find(state.variations, id);
    requireProject(v.projectId);
    return v;
  }
  function refreshNeeds(projectId: string) {
    const previous = state.materialNeeds.filter(
      (n) => n.projectId === projectId && n.source === "variation",
    );
    state.materialNeeds = state.materialNeeds.filter(
      (n) => n.projectId !== projectId || n.source !== "variation",
    );
    const active = state.variations.filter(
      (v) => v.projectId === projectId && v.status !== "rejected",
    );
    for (const material of state.materials) {
      const lines = active.flatMap((v) =>
        v.costLines
          .filter((l) => l.materialId === material.id)
          .map((l) => ({ line: l, ref: v.ref })),
      );
      if (!lines.length) continue;
      const quantity = lines.reduce((sum, l) => sum + l.line.quantityDelta, 0);
      const forecast = state.forecasts.find(
        (f) => f.materialId === material.id,
      )!.forecast[0];
      state.materialNeeds.push({
        projectId,
        materialId: material.id,
        quantity,
        neededBy: previous.find((n) => n.materialId === material.id)?.neededBy,
        source: "variation",
        sourceRefs: [...new Set(lines.map((l) => l.ref))],
        exposureHKD: {
          p10: Math.round(quantity * forecast.p10 * 100) / 100,
          p50: Math.round(quantity * forecast.p50 * 100) / 100,
          p90: Math.round(quantity * forecast.p90 * 100) / 100,
        },
      });
    }
  }
  return [
    route("get", "/projects/:projectId/variations", ({ params, request }) => {
      const id = String(params.projectId);
      requireProject(id);
      const status = new URL(request.url).searchParams.get("status");
      return reply(
        z.array(s.variationEventSchema),
        state.variations.filter(
          (v) => v.projectId === id && (!status || v.status === status),
        ),
      );
    }),
    route(
      "post",
      "/projects/:projectId/variations",
      async ({ params, request }) => {
        requirePermission("variation.raise");
        const projectId = String(params.projectId);
        requireProject(projectId);
        const body = z
          .object({
            title: z.string().trim().min(1),
            sourceChangeIds: z.array(z.string()).min(1),
            comparisonId: z.string(),
          })
          .parse(await request.json());
        const comparison = find(state.comparisons, body.comparisonId);
        if (comparison.projectId !== projectId)
          throw new MockError(400, "Comparison belongs to another project.");
        const changes = [...new Set(body.sourceChangeIds)].map((id) =>
          find(state.changes, id),
        );
        if (
          changes.some(
            (c) => c.comparisonId !== comparison.id || c.variationEventId,
          )
        )
          throw new MockError(
            409,
            "Choose changes from this comparison that are not already linked to a variation event.",
          );
        const number =
          Math.max(
            ...state.variations.map((v) => Number(v.ref.replace("VE-", ""))),
            0,
          ) + 1;
        const id = `VE-${String(number).padStart(3, "0")}`;
        const seq = { value: 0 };
        const seeded = seedCostLines(ctx, changes, seq);
        const v: s.VariationEvent = {
          id,
          projectId,
          ref: id,
          title: body.title,
          sourceChangeIds: changes.map((c) => c.id),
          comparisonId: comparison.id,
          drawingNumber: find(state.documents, comparison.documentId).docNumber,
          status: "potential",
          costLines: seeded.lines,
          indicativeCost: seeded.indicativeCost,
          raisedBy: currentUser().id,
          raisedAt: now(),
        };
        state.variations.push(v);
        for (const change of changes) {
          change.status = "potential_variation";
          change.review = { by: currentUser().id, at: now() };
          change.variationEventId = v.id;
          state.links.push({
            from: { type: "variation", id: v.id },
            to: { type: "change", id: change.id },
          });
          audit(
            "change.marked_potential_variation",
            "change",
            change.id,
            "Drawing change linked to a potential variation",
          );
        }
        audit(
          "variation.raised",
          "variation",
          v.id,
          `${v.ref} raised from drawing changes`,
        );
        return reply(s.variationEventSchema, v, 201);
      },
    ),
    route("get", "/variations/:variationId", ({ params }) =>
      reply(s.variationEventSchema, variation(String(params.variationId))),
    ),
    route(
      "put",
      "/variations/:variationId/cost-lines",
      async ({ params, request }) => {
        requirePermission("variation.editCost");
        const v = variation(String(params.variationId));
        const { costLines } = z
          .object({ costLines: z.array(s.costLineSchema) })
          .parse(await request.json());
        for (const line of costLines) {
          if (line.materialId) find(state.materials, line.materialId);
          if (line.rateSource === "contract_boq") {
            const current = state.workbooks
              .filter((w) => w.projectId === v.projectId && w.kind === "boq")
              .map((w) => w.currentVersionId);
            const item = state.items.find(
              (i) =>
                current.includes(i.workbookVersionId) &&
                i.itemRef === line.boqItemRef,
            );
            if (!item || item.rate !== line.rate)
              throw new MockError(
                400,
                "Use a rate from the current BOQ or mark the rate source as manual.",
              );
          }
        }
        const total =
          Math.round(costLines.reduce((sum, l) => sum + l.amount, 0) * 100) /
          100;
        const ends = [
          total * variationRangeRule.lowFactor,
          total * variationRangeRule.highFactor,
        ].sort((a, b) => a - b);
        v.costLines = costLines;
        v.indicativeCost = {
          total,
          low: Math.round(ends[0] * 100) / 100,
          high: Math.round(ends[1] * 100) / 100,
          basis: variationRangeRule.basis,
        };
        for (const line of costLines) {
          const item = state.items.find(
            (i) =>
              i.itemRef === line.boqItemRef &&
              state.workbooks.some(
                (w) =>
                  w.projectId === v.projectId &&
                  w.currentVersionId === i.workbookVersionId,
              ),
          );
          if (
            item &&
            !state.links.some((l) => l.from.id === v.id && l.to.id === item.id)
          )
            state.links.push({
              from: { type: "variation", id: v.id },
              to: { type: "boq_item", id: item.id },
            });
          if (
            line.materialId &&
            !state.links.some(
              (l) => l.from.id === v.id && l.to.id === line.materialId,
            )
          )
            state.links.push({
              from: { type: "variation", id: v.id },
              to: { type: "material", id: line.materialId },
            });
        }
        refreshNeeds(v.projectId);
        audit(
          "variation.cost_updated",
          "variation",
          v.id,
          `${v.ref} indicative cost updated`,
          { total, range: v.indicativeCost },
        );
        return reply(s.variationEventSchema, v);
      },
    ),
    route(
      "post",
      "/variations/:variationId/decision",
      async ({ params, request }) => {
        requirePermission("variation.decide");
        const v = variation(String(params.variationId));
        const body = z
          .object({
            status: z.enum(["confirmed", "rejected"]),
            reason: z.string().trim().min(1),
          })
          .parse(await request.json());
        v.status = body.status;
        v.decision = { ...body, by: currentUser().id, at: now() };
        refreshNeeds(v.projectId);
        audit(
          `variation.${body.status}`,
          "variation",
          v.id,
          `${v.ref} ${body.status}`,
          { reason: body.reason },
        );
        return reply(s.variationEventSchema, v);
      },
    ),
  ];
}
