import * as s from "@/schemas";
import drawingFiles from "./drawing-files.json";
import workbookFiles from "./workbook-files.json";
import regions from "./drawing-regions.json";
import workbookData from "./workbook-data.json";
import { users } from "./users";
import { seededRandom } from "./random";
import { calculateAdvice } from "../procurement";
import type { ParsedWorkbook } from "../workbook-engine";
export const fixtureTime = "2026-11-04T00:00:00Z";
export const bimArtifactPayload = {
  job_id: "job-bim-001",
  filename: "sample-model.ifc",
  generated_at: fixtureTime,
  result: s.bimResultSchema.parse({
    report: {
      overall_score: 61,
      gate_state: "READY",
      category_scores: {},
      issues: [],
      material_mappings: {},
      material_family_summary: {},
      summary: "Sample BIM analysis result for procurement extraction.",
      element_count: 2,
      spec_count: 2,
    },
    elements: [],
    boq: [
      {
        item_id: "BOQ-1",
        description: "High-tensile steel rebar",
        quantity: 4.2,
        unit: "tonne",
        rate: 6850,
        total_price: 28770,
        price_book_item_code: "MAT-001",
        material_code: "MAT-001",
        bim_element: "Structure",
        material_family: "Steel",
        element_ids: [],
      },
      {
        item_id: "BOQ-2",
        description: "Ready-mixed concrete C35",
        quantity: 20,
        unit: "m³",
        rate: 1050,
        total_price: 21000,
        price_book_item_code: "MAT-002",
        material_code: "MAT-002",
        bim_element: "Structure",
        material_family: "Concrete",
        element_ids: [],
      },
    ],
  }),
};
export const project = s.projectSchema.parse({
  id: "P-001",
  code: "P-001",
  name: "Central Market Rehab Phase 2",
  location: "Central, Hong Kong",
  buildingType: "mixedUse",
  createdAt: "2026-11-01T00:00:00Z",
  memberIds: users.map((u) => u.id),
});
export const filePaths: Record<string, string> = {};
export const documents: s.HubDocument[] = [];
export const versions: s.DocumentVersion[] = [];
export const conflicts: s.VersionConflict[] = [];
function document(
  id: string,
  category: s.DocumentCategory,
  docNumber: string,
  title: string,
  labels: string[],
  fileKeys: string[],
  discipline?: s.Discipline,
) {
  const entries = labels.map((label, i) => {
    const file = (
      { ...drawingFiles, ...workbookFiles } as Record<
        string,
        {
          path: string;
          sha256: string;
          sizeBytes: number;
          mimeType: string;
          pageCount?: number;
        }
      >
    )[fileKeys[i]];
    const versionId = `${id}-v${i + 1}`;
    filePaths[versionId] = file.path;
    return s.documentVersionSchema.parse({
      id: versionId,
      documentId: id,
      label,
      fileName: file.path.split("/").at(-1),
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      pageCount: file.pageCount,
      status: i === labels.length - 1 ? "current" : "superseded",
      issuedDate: "2026-11-01",
      uploadedBy: users[0].role,
      uploadedAt: fixtureTime,
    });
  });
  versions.push(...entries);
  documents.push(
    s.hubDocumentSchema.parse({
      id,
      projectId: project.id,
      category,
      docNumber,
      title,
      discipline,
      currentVersionId: entries.at(-1)!.id,
      versionCount: entries.length,
      hasConflict: false,
      tags: [],
      updatedAt: fixtureTime,
    }),
  );
}
document(
  "D-A201",
  "drawing",
  "A-201",
  "Level 2 floor plan",
  ["A", "B", "C"],
  ["A-201-A", "A-201-B", "A-201-C"],
  "architectural",
);
document(
  "D-S110",
  "drawing",
  "S-110",
  "Structural framing plan",
  ["P1", "P2"],
  ["S-110-P1", "S-110-P2"],
  "structural",
);
document(
  "D-BOQ",
  "financial",
  "BOQ-001",
  "Contract BOQ",
  ["1", "2"],
  ["boq-v1", "boq-v2"],
);
const categories: s.DocumentCategory[] = [
  "contract",
  "site_record",
  "financial",
  "correspondence",
  "drawing",
];
for (let i = 0; i < 37; i++) {
  const category = categories[i % categories.length];
  const number =
    category === "contract"
      ? `CON-${String(Math.floor(i / 5) + 1).padStart(3, "0")}`
      : `${category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`;
  document(
    `D-${i + 1}`,
    category,
    number,
    `${category.replaceAll("_", " ")} record ${i + 1}`,
    ["1"],
    ["record"],
    category === "drawing" ? "other" : undefined,
  );
}
const bimArtifactDocId = "D-BIM-001";
const bimArtifactVersionId = "BIM-001-v1";
const bimArtifactBytes = new TextEncoder().encode(
  JSON.stringify(bimArtifactPayload),
);
versions.push(
  s.documentVersionSchema.parse({
    id: bimArtifactVersionId,
    documentId: bimArtifactDocId,
    label: "A",
    fileName: "sample-bim-assessment.json",
    mimeType: "application/json",
    sizeBytes: bimArtifactBytes.byteLength,
    sha256: "0".repeat(64),
    status: "current",
    uploadedBy: users[0].role,
    uploadedAt: fixtureTime,
  }),
);
documents.push(
  s.hubDocumentSchema.parse({
    id: bimArtifactDocId,
    projectId: project.id,
    category: "site_record",
    docNumber: "BIM-001",
    title: "BIM analysis · sample-model.ifc",
    currentVersionId: bimArtifactVersionId,
    versionCount: 1,
    hasConflict: false,
    tags: [],
    updatedAt: fixtureTime,
  }),
);
const contract = documents.find((d) => d.docNumber === "CON-004")!;
const original = versions.find((v) => v.id === contract.currentVersionId)!;
original.label = "2";
const conflictVersion = s.documentVersionSchema.parse({
  ...original,
  id: `${contract.id}-v2`,
  fileName: "conditions-rev2-alternative.pdf",
  sha256: drawingFiles["record-alternative"].sha256,
  sizeBytes: drawingFiles["record-alternative"].sizeBytes,
  status: "conflict",
});
versions.push(conflictVersion);
filePaths[conflictVersion.id] = drawingFiles["record-alternative"].path;
contract.versionCount++;
contract.hasConflict = true;
conflicts.push(
  s.versionConflictSchema.parse({
    id: "VC-001",
    documentId: contract.id,
    kind: "same_label_different_file",
    versionIds: [original.id, conflictVersion.id],
    detectedAt: fixtureTime,
  }),
);
const duplicateDoc = documents.find((d) => d.docNumber === "CON-001")!;
const duplicateBase = versions.find(
  (v) => v.id === duplicateDoc.currentVersionId,
)!;
const duplicate = s.documentVersionSchema.parse({
  ...duplicateBase,
  id: `${duplicateDoc.id}-v2`,
  status: "conflict",
});
versions.push(duplicate);
filePaths[duplicate.id] = filePaths[duplicateBase.id];
duplicateDoc.hasConflict = true;
duplicateDoc.versionCount++;
conflicts.push(
  s.versionConflictSchema.parse({
    id: "VC-002",
    documentId: duplicateDoc.id,
    kind: "duplicate_file",
    versionIds: [duplicateBase.id, duplicate.id],
    detectedAt: fixtureTime,
  }),
);
const counts = (list: { kind: string }[]) =>
  Object.fromEntries(
    s.changeKindSchema.options.map((k) => [
      k,
      list.filter((c) => c.kind === k).length,
    ]),
  );
export const comparisons = [
  s.drawingComparisonSchema.parse({
    id: "CMP-A201",
    projectId: project.id,
    documentId: "D-A201",
    baseVersionId: "D-A201-v2",
    targetVersionId: "D-A201-v3",
    status: "succeeded",
    progressPct: 100,
    alignment: {
      dx: 0,
      dy: 0,
      scale: 1,
      rotationDeg: 0,
      method: "auto",
      quality: 0.96,
    },
    pageCount: 1,
    changeCounts: counts(regions.a201),
    modelVersion: "mock-drawing-1.0",
    createdAt: fixtureTime,
    finishedAt: fixtureTime,
  }),
  s.drawingComparisonSchema.parse({
    id: "CMP-S110",
    projectId: project.id,
    documentId: "D-S110",
    baseVersionId: "D-S110-v1",
    targetVersionId: "D-S110-v2",
    status: "succeeded",
    progressPct: 100,
    alignment: {
      dx: 0,
      dy: 0,
      scale: 1,
      rotationDeg: 0,
      method: "auto",
      quality: 0.78,
    },
    pageCount: 1,
    changeCounts: counts(regions.s110),
    modelVersion: "mock-drawing-1.0",
    createdAt: fixtureTime,
    finishedAt: fixtureTime,
  }),
];
export const changes = [
  ...regions.a201.map((c, i) =>
    s.drawingChangeSchema.parse({
      ...c,
      id: `CH-A201-${i + 1}`,
      comparisonId: "CMP-A201",
      number: i + 1,
      page: 1,
      confidence: [0.96, 0.94, 0.87, 0.58][i],
      status: i < 2 ? "potential_variation" : "new",
      ...(i < 2
        ? {
            review: { by: users[1].id, at: fixtureTime },
            variationEventId: "VE-007",
          }
        : {}),
    }),
  ),
  ...regions.s110.map((c, i) =>
    s.drawingChangeSchema.parse({
      ...c,
      id: `CH-S110-${i + 1}`,
      comparisonId: "CMP-S110",
      number: i + 1,
      page: 1,
      confidence: 0.9,
      status: "new",
    }),
  ),
];
export const parsedWorkbooks = workbookData as unknown as Record<
  string,
  ParsedWorkbook
>;
export const workbooks = [
  s.workbookSchema.parse({
    id: "WB-001",
    projectId: project.id,
    documentId: "D-BOQ",
    name: "Contract BOQ",
    kind: "boq",
    currentVersionId: "WV-2",
    mapping: {
      sheet: "BOQ",
      headerRow: 1,
      columns: {
        itemRef: "A",
        description: "B",
        unit: "C",
        quantity: "D",
        rate: "E",
        amount: "F",
        section: "G",
      },
    },
    updatedAt: fixtureTime,
  }),
];
export const workbookVersions = [1, 2].map((v) => {
  const key = `boq-v${v}` as keyof typeof workbookFiles;
  const f = workbookFiles[key];
  const parsed = parsedWorkbooks[key];
  return s.workbookVersionSchema.parse({
    id: `WV-${v}`,
    workbookId: "WB-001",
    versionNumber: v,
    fileName: `boq-v${v}.xlsx`,
    sha256: f.sha256,
    sizeBytes: f.sizeBytes,
    sheetNames: parsed.sheetNames,
    status: "checked",
    checkSummary: {
      errors: parsed.checks.filter((c) => c.severity === "error").length,
      warnings: parsed.checks.filter((c) => c.severity === "warning").length,
      info: 0,
    },
    totals: parsed.totals,
    uploadedBy: users[1].role,
    uploadedAt: fixtureTime,
  });
});
export const boqItems = Object.values(parsedWorkbooks).flatMap((p) =>
  p.items.map((i) => s.boqItemSchema.parse(i)),
);
export const checks = Object.values(parsedWorkbooks).flatMap((p) =>
  p.checks.map((c) => s.workbookCheckSchema.parse(c)),
);
const costLines: s.CostLine[] = [
  {
    id: "CL-1",
    boqItemRef: "3.2.14",
    description: "High-tensile rebar",
    unit: "tonne",
    quantityDelta: 4.2,
    rate: 7000,
    rateSource: "contract_boq",
    amount: 29400,
    materialId: "rebar",
  },
  {
    id: "CL-2",
    boqItemRef: "2.1.08",
    description: "Concrete to additional beams",
    unit: "m³",
    quantityDelta: 20,
    rate: 3600,
    rateSource: "contract_boq",
    amount: 72000,
    materialId: "concrete",
  },
  {
    id: "CL-3",
    boqItemRef: "2.4.03",
    description: "Formwork to beam sides",
    unit: "m²",
    quantityDelta: 100,
    rate: 850,
    rateSource: "contract_boq",
    amount: 85000,
    materialId: "timber",
  },
];
export const variations = [
  s.variationEventSchema.parse({
    id: "VE-007",
    projectId: project.id,
    ref: "VE-007",
    title: "Slab opening and additional beam",
    drawingNumber: "A-201",
    sourceChangeIds: ["CH-A201-1", "CH-A201-2"],
    comparisonId: "CMP-A201",
    status: "potential",
    costLines,
    indicativeCost: {
      total: 186400,
      low: 171000,
      high: 203000,
      basis:
        "QS-entered quantities × contract BOQ rates; indicative range for review.",
    },
    raisedBy: users[1].role,
    raisedAt: fixtureTime,
  }),
  ...Array.from({ length: 5 }, (_, i) =>
    s.variationEventSchema.parse({
      id: `VE-00${[1, 2, 3, 4, 6][i]}`,
      projectId: project.id,
      ref: `VE-00${[1, 2, 3, 4, 6][i]}`,
      title: `Structural change review ${i + 1}`,
      drawingNumber: "S-110",
      sourceChangeIds: ["CH-S110-1"],
      comparisonId: "CMP-S110",
      status: [
        "under_review",
        "confirmed",
        "rejected",
        "potential",
        "under_review",
      ][i],
      costLines: [],
      raisedBy: users[1].role,
      raisedAt: fixtureTime,
      ...([1, 2].includes(i)
        ? {
            decision: {
              status: i === 1 ? "confirmed" : "rejected",
              by: users[0].id,
              at: fixtureTime,
              reason: "Reviewed against the current construction drawings.",
            },
          }
        : {}),
    }),
  ),
];
const random = seededRandom();
const materialDefinitions = [
  ["rebar", "High-tensile steel rebar", "tonne", "steel", 6850],
  ["structural-steel", "Structural steel", "tonne", "steel", 8100],
  ["concrete", "Ready-mixed concrete C35", "m³", "concrete", 1050],
  ["cement", "Cement", "tonne", "cement", 980],
  ["aggregate", "Aggregate", "tonne", "aggregate", 320],
  ["timber", "Timber formwork", "m²", "timber", 210],
  ["copper", "Copper cable", "tonne", "copper", 72000],
  ["glass", "Float glass", "m²", "glass", 180],
  ["waterproofing", "Waterproofing membrane", "m²", "waterproofing", 95],
  ["diesel", "Diesel", "litre", "other", 18],
] as const;
const period = (offset: number) => {
  const date = new Date(Date.UTC(2021, 10 + offset, 1));
  return date.toISOString().slice(0, 7);
};
export const materials = materialDefinitions.map(
  ([id, name, unit, category, price], i) =>
    s.materialSchema.parse({
      id,
      code: `MAT-${String(i + 1).padStart(3, "0")}`,
      name,
      unit,
      category,
      source:
        "C&SD / CEDD monthly average wholesale prices — synthetic demo data",
      latestPrice: price,
      latestPeriod: "2026-10",
      change3mPct: 0,
      trend: id === "concrete" ? "stable" : "rising",
    }),
);
export const forecasts = materials.map((m) => {
  const history = Array.from({ length: 60 }, (_, i) => ({
    period: period(i),
    price:
      Math.round(m.latestPrice * (0.76 + i * 0.004 + random() * 0.015) * 100) /
      100,
  }));
  history[59].price = m.latestPrice;
  m.change3mPct =
    Math.round((m.latestPrice / history[56].price - 1) * 1000) / 10;
  return s.priceForecastSchema.parse({
    materialId: m.id,
    history,
    forecast: Array.from({ length: 12 }, (_, i) => {
      const p50 =
        m.id === "rebar"
          ? [
              6900, 6800, 6650, 6500, 6500, 7261, 7380, 7450, 7510, 7600, 7700,
              7800,
            ][i]
          : m.id === "concrete"
            ? m.latestPrice
            : Math.round(m.latestPrice * (1 + (i + 1) * 0.01));
      const width = 0.04 + i * 0.007;
      return {
        period: period(60 + i),
        p50,
        p10: Math.round(p50 * (1 - width)),
        p90: Math.round(p50 * (1 + width)),
        p025: Math.round(p50 * (1 - width * 1.8)),
        p975: Math.round(p50 * (1 + width * 1.8)),
      };
    }),
    model: {
      name: "Synthetic monthly materials model",
      version: "demo-1.0",
      trainedThrough: "2026-10",
      horizonMonths: 12,
      backtestMapePct: 4.8,
      drivers: [
        "Wholesale material prices",
        "Construction price index",
        "Wage index",
      ],
    },
  });
});
export const procurement = ["rebar", "concrete", "copper"].map((id, i) =>
  calculateAdvice({
    id: `PA-${i + 1}`,
    projectId: project.id,
    material: materials.find((m) => m.id === id)!,
    forecast: forecasts.find((f) => f.materialId === id)!,
    quantity: id === "rebar" ? 4.2 : 100,
    neededBy: "2027-06-01T00:00:00Z",
    leadTimeWeeks: 8,
    createdBy: users[1].role,
    createdAt: fixtureTime,
  }),
);
export const materialNeeds = [
  s.projectMaterialNeedSchema.parse({
    projectId: project.id,
    materialId: "rebar",
    quantity: 4.2,
    neededBy: "2027-06-01T00:00:00Z",
    source: "variation",
    sourceRefs: ["VE-007"],
    exposureHKD: {
      p10: procurement[0].range.low,
      p50: procurement[0].expectedCostInWindow,
      p90: procurement[0].range.high,
    },
  }),
  s.projectMaterialNeedSchema.parse({
    projectId: project.id,
    materialId: "concrete",
    quantity: 100,
    source: "boq",
    sourceRefs: ["2.1.08"],
    exposureHKD: { p10: 100000, p50: 105000, p90: 110000 },
  }),
];
export const links: s.EntityLink[] = [
  ...changes.map((c) =>
    s.entityLinkSchema.parse({
      from: { type: "change", id: c.id },
      to: {
        type: "document_version",
        id: c.comparisonId === "CMP-A201" ? "D-A201-v3" : "D-S110-v2",
      },
    }),
  ),
  s.entityLinkSchema.parse({
    from: { type: "variation", id: "VE-007" },
    to: { type: "material", id: "rebar" },
  }),
  ...variations.flatMap((v) =>
    v.sourceChangeIds.map((id) =>
      s.entityLinkSchema.parse({
        from: { type: "variation", id: v.id },
        to: { type: "change", id },
      }),
    ),
  ),
  ...costLines.map((line) =>
    s.entityLinkSchema.parse({
      from: { type: "variation", id: "VE-007" },
      to: {
        type: "boq_item",
        id: boqItems.find(
          (i) =>
            i.workbookVersionId === "WV-2" && i.itemRef === line.boqItemRef,
        )!.id,
      },
    }),
  ),
  s.entityLinkSchema.parse({
    from: { type: "workbook_version", id: "WV-2" },
    to: { type: "document_version", id: "D-BOQ-v2" },
  }),
];
export const auditEvents = [
  [
    "document.version_uploaded",
    "document_version",
    "D-A201-v3",
    "Rev C uploaded; Rev B superseded",
  ],
  [
    "comparison.completed",
    "comparison",
    "CMP-A201",
    "Comparison ready — four changes found",
  ],
  [
    "change.marked_potential_variation",
    "change",
    "CH-A201-1",
    "Slab opening marked as a potential variation",
  ],
  [
    "variation.raised",
    "variation",
    "VE-007",
    "VE-007 raised from two drawing changes",
  ],
  [
    "variation.cost_updated",
    "variation",
    "VE-007",
    "Indicative cost HK$186,400 with range HK$171,000–203,000",
  ],
  [
    "procurement.created",
    "procurement",
    "PA-1",
    "Rebar advice saved for Feb–Mar 2027",
  ],
  [
    "document.version_uploaded",
    "document_version",
    "D-BOQ-v2",
    "BOQ version 2 uploaded",
  ],
  [
    "workbook.checked",
    "workbook_version",
    "WV-2",
    "BOQ checks completed; formula and amount problems require review",
  ],
].map((entry, i) =>
  s.auditEventSchema.parse({
    id: `AE-${i + 1}`,
    at: new Date(Date.parse(fixtureTime) + i * 60000).toISOString(),
    actorId: users[1].id,
    actorRole: "qs",
    action: entry[0],
    entityType: entry[1],
    entityId: entry[2],
    summary: entry[3],
  }),
);

// Complete the base/target and BOQ → workbook/material traceability graph.
for (const change of changes) {
  const comparison = comparisons.find((c) => c.id === change.comparisonId)!;
  links.push(
    s.entityLinkSchema.parse({
      from: { type: "change", id: change.id },
      to: { type: "document_version", id: comparison.baseVersionId },
    }),
  );
}
for (const item of boqItems) {
  links.push(
    s.entityLinkSchema.parse({
      from: { type: "boq_item", id: item.id },
      to: { type: "workbook_version", id: item.workbookVersionId },
    }),
  );
  if (item.materialId)
    links.push(
      s.entityLinkSchema.parse({
        from: { type: "boq_item", id: item.id },
        to: { type: "material", id: item.materialId },
      }),
    );
}
links.push(
  s.entityLinkSchema.parse({
    from: { type: "workbook_version", id: "WV-1" },
    to: { type: "document_version", id: "D-BOQ-v1" },
  }),
);
