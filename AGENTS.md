# AGENTS.md — Smart QS (AegisQS) Front-End

> Persistent context for AI coding agents (Codex, Claude Code, Cursor, etc.).
> Read this file and `DESIGN.md` fully before every task. If a task prompt conflicts with either, stop and ask.
> Scope revised November 2026 for the hackathon. Anything not described here has been **dropped** — do not build it.

---

## 1. Product in one paragraph

Smart QS (codename **AegisQS**) is a workspace for **Quantity Surveyors (QS)** on Hong Kong building projects. It does four things:

1. **Drawing revision analysis** — compares successive revisions of a 2D drawing, highlights what changed, and lets the QS raise a **potential variation** early, with an **indicative cost** linked to BOQ items.
2. **Material cost forecasting & procurement timing** — forecasts the price of individual materials and advises **when to buy** to reduce exposure to price swings.
3. **Document hub** — one place for contract documents, drawings, site records and financial data, with versions, a single "current" copy, and a full audit trail.
4. **Excel integration** — QS teams keep working in Excel; Smart QS stores every workbook version, checks it for errors, and shows what changed between versions.

The four features connect through one demo story (§2). The product **assists** a QS; it never decides. Forecasts are ranges, not promises. Detected drawing changes are suggestions until a QS reviews them.

---

## 2. The connected demo story (what the MVP must show end to end)

```
1. QS uploads Drawing A-201 Rev C to the Document hub
      → hub detects it supersedes Rev B, marks Rev C "Current", logs it
2. Comparison runs automatically (Rev B → Rev C)
      → 4 changes highlighted on the drawing as revision clouds
3. QS reviews a change ("Slab opening enlarged; additional beam added")
      → marks it "Potential variation" → Variation event VE-007 created
4. QS links VE-007 to BOQ items from the project's Excel BOQ
      → enters quantity changes → indicative cost HK$186,400 (range HK$171k–203k)
5. VE-007 adds 4.2 t of rebar → Materials shows the rebar forecast rising
      → procurement advice: "Buy within Feb–Mar 2027", expected saving + risk range
6. QS updates the BOQ in Excel and re-uploads it
      → checks catch a quantity × rate mismatch; version diff shows the new rows
7. Every step above appears in the audit trail
```

If a feature doesn't serve this story or one of the four modules, it is out of scope.

---

## 3. Domain glossary (use these terms consistently in code and UI)

| Term | Meaning |
|---|---|
| QS | Quantity Surveyor |
| BOQ | Bill of Quantities — line items (item ref, description, unit, quantity, rate, amount) |
| Drawing | A 2D construction drawing (PDF or image), identified by a drawing number (e.g. `A-201`) |
| Revision | A version of a drawing, labelled by the issuer (`P1`, `A`, `B`, `C`…) |
| Comparison | One run comparing a base revision with a newer target revision |
| Change | A detected difference region on the drawing (added / removed / modified / dimension / annotation) |
| Revision cloud | The scalloped outline drafters draw round a change; our UI uses it to mark detected changes |
| Variation event (VE) | An early-warning record that a change may become a variation to the contract |
| VO | Variation Order — the formal instruction that follows a confirmed variation (not built in MVP) |
| Indicative cost | A QS-assisted estimate of a change's cost, from BOQ rates × quantity changes; always shown with a range |
| Material | A priced resource tracked over time (e.g. high-tensile rebar, ready-mixed concrete C35) |
| Forecast | Predicted monthly price with a median (p50) and uncertainty bands (p10–p90, p2.5–p97.5) |
| Procurement window | The months in which buying is expected to cost least, given need-by date and lead time |
| Document | A logical record in the hub (e.g. "Main contract — Conditions") with one or more versions |
| Current version | The single version everyone should use; older ones are "Superseded" |
| Conflict | Two files claiming to be the same version, a duplicate upload, or an out-of-order revision |
| Workbook | An Excel file tracked in Smart QS (BOQ, cost plan, valuation…) with versions |
| Check | An automated rule run on a workbook version (formula errors, sum mismatches, outlier rates…) |
| Column mapping | Which Excel columns hold item ref / description / unit / quantity / rate / amount |

---

## 4. Users and permissions

| Role key | Who | Can | Cannot |
|---|---|---|---|
| `senior_qs` | Lead QS on a project | Everything in the project; **confirm or reject** variation events; set a document version as current when there is a conflict | Admin settings |
| `qs` | QS / assistant QS | Upload documents, drawings and workbooks; run comparisons; review changes; raise variation events; link costs; edit column mappings; resolve or ignore workbook checks; create procurement plans | Confirm/reject variation events; resolve version conflicts |
| `viewer` | Project manager, client rep | Read everything in projects they are added to; download current versions | Upload, edit, decide |
| `admin` | Org admin | Users, roles, project membership, material catalogue, audit log | Project decisions (unless also `senior_qs`) |

Implement as one map in `src/lib/auth/permissions.ts` and a `can(user, permission, resource?)` helper. Components call `can()` — never compare role strings inline.

```ts
export const PERMISSIONS = {
  'project.view':          ['senior_qs', 'qs', 'viewer', 'admin'],
  'document.upload':       ['senior_qs', 'qs'],
  'document.setCurrent':   ['senior_qs'],
  'comparison.run':        ['senior_qs', 'qs'],
  'change.review':         ['senior_qs', 'qs'],
  'variation.raise':       ['senior_qs', 'qs'],
  'variation.editCost':    ['senior_qs', 'qs'],
  'variation.decide':      ['senior_qs'],
  'workbook.upload':       ['senior_qs', 'qs'],
  'workbook.editMapping':  ['senior_qs', 'qs'],
  'workbook.resolveCheck': ['senior_qs', 'qs'],
  'procurement.plan':      ['senior_qs', 'qs'],
  'admin.manage':          ['admin'],
} as const;
```

UI gating is a convenience; the backend is the real enforcement point.

---

## 5. Tech stack (do not substitute without asking)

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript `strict: true` |
| Package manager | **npm** — commit `package-lock.json`; never create `pnpm-lock.yaml` or `yarn.lock`; use `npm ci` in CI |
| Styling | Tailwind CSS v4 with tokens from `DESIGN.md` §3 |
| UI primitives | shadcn/ui + **21st.dev** components (installed into `src/components/ui`, restyled per `DESIGN.md` §12) on Radix UI |
| Server state | TanStack Query |
| Data grid | TanStack Table + TanStack Virtual |
| Charts | Apache ECharts via `echarts-for-react` |
| PDF / drawing rendering | `react-pdf` (PDF.js) rendering to canvas; images via `<canvas>` |
| Pan & zoom | `react-zoom-pan-pinch` (shared transform state for synced viewers) |
| Excel parsing (mock backend only) | `exceljs` — used in MSW handlers and `scripts/` so the demo works with real `.xlsx` files |
| Mock drawing generation (dev only) | `pdf-lib` — `scripts/make-mock-drawings.ts` |
| File upload | `react-dropzone` |
| Schemas / validation | Zod — every API response is parsed through a Zod schema |
| Forms | React Hook Form + Zod resolver |
| Dates | `date-fns` |
| i18n | `next-intl`, locales `en` and `zh-HK` (Traditional Chinese) |
| Mock backend | MSW 2.x (HTTP + WebSocket handlers) |
| Tests | Vitest + Testing Library; Playwright for E2E |
| Lint / format | ESLint + Prettier |

Adding any dependency not listed requires a one-line justification in your plan and user approval.

---

## 6. System context (what the front end talks to)

- **REST API** under `/api/v1`, JWT in an **httpOnly cookie** set by the backend. Never store tokens in `localStorage`/`sessionStorage`.
- **WebSocket** `/ws?projectId=…` pushes comparison progress, workbook check results and hub events.
- **Backend jobs (not front-end work):** drawing alignment + change detection, Excel parsing + checks, price forecasting models, file storage with SHA-256 hashes.
- The front end **renders** drawings and draws overlays and revision clouds client-side; it does **not** detect changes itself.
- Until the backend exists, everything runs on **MSW mocks** (`NEXT_PUBLIC_API_MOCKING=enabled`).

---

## 7. Data contracts (source of truth)

Live in `src/schemas/*.ts` as Zod schemas; types come from `z.infer`. **Do not change a contract without updating schemas, mocks and fixtures in the same change and calling it out in your summary.**

```ts
// ---------- shared ----------
type Role = 'senior_qs' | 'qs' | 'viewer' | 'admin';
type ISODate = string;                 // ISO 8601
type Period = string;                  // 'YYYY-MM'
interface BBox { x: number; y: number; w: number; h: number }  // normalised 0–1 of the page

interface User { id: string; name: string; email: string; role: Role; locale: 'en' | 'zh-HK' }
interface Project { id: string; code: string; name: string; createdAt: ISODate; memberIds: string[] }

// ---------- document hub ----------
type DocumentCategory = 'contract' | 'drawing' | 'site_record' | 'financial' | 'correspondence';
type Discipline = 'architectural' | 'structural' | 'building_services' | 'civil' | 'other';

interface HubDocument {
  id: string; projectId: string;
  category: DocumentCategory;
  docNumber: string;                   // e.g. 'A-201', 'CON-001', 'SD-2026-11-03'
  title: string;
  discipline?: Discipline;
  currentVersionId?: string;
  versionCount: number;
  hasConflict: boolean;
  tags: string[];
  updatedAt: ISODate;
}

interface DocumentVersion {
  id: string; documentId: string;
  label: string;                       // revision label: 'P1', 'A', 'B', 'C' or '1', '2'…
  fileName: string; mimeType: string; sizeBytes: number; sha256: string;
  pageCount?: number;
  status: 'current' | 'superseded' | 'conflict' | 'processing';
  issuedDate?: ISODate;                // date on the drawing / document
  notes?: string;
  uploadedBy: string; uploadedAt: ISODate;
}

interface VersionConflict {
  id: string; documentId: string;
  kind: 'duplicate_file' | 'same_label_different_file' | 'out_of_order_label';
  versionIds: string[];
  detectedAt: ISODate;
  resolution?: { keptVersionId: string; by: string; at: ISODate; reason: string };
}

interface EntityLink {                 // cross-feature traceability
  from: { type: 'document_version' | 'change' | 'variation' | 'boq_item' | 'workbook_version' | 'material'; id: string };
  to:   { type: 'document_version' | 'change' | 'variation' | 'boq_item' | 'workbook_version' | 'material'; id: string };
}

// ---------- drawing revision analysis ----------
interface DrawingComparison {
  id: string; projectId: string; documentId: string;
  baseVersionId: string; targetVersionId: string;
  status: 'queued' | 'aligning' | 'detecting' | 'succeeded' | 'failed';
  progressPct: number; error?: string;
  alignment: { dx: number; dy: number; scale: number; rotationDeg: number; method: 'auto' | 'manual'; quality: number }; // quality 0–1
  pageCount: number;
  changeCounts: Record<ChangeKind, number>;
  modelVersion: string;
  createdAt: ISODate; finishedAt?: ISODate;
}

type ChangeKind = 'added' | 'removed' | 'modified' | 'dimension' | 'annotation';
type ChangeStatus = 'new' | 'no_variation' | 'potential_variation';

interface DrawingChange {
  id: string; comparisonId: string;
  number: number;                      // shown in the revision tag △1, △2…
  page: number; bbox: BBox;
  kind: ChangeKind;
  summary: string;                     // AI-written, e.g. "Slab opening enlarged from 1.2 × 1.2 m to 1.8 × 1.5 m"
  textBefore?: string; textAfter?: string;   // for dimension / annotation changes
  confidence: number;                  // 0–1
  status: ChangeStatus;
  review?: { by: string; at: ISODate; note?: string };
  variationEventId?: string;
}

// ---------- variation events ----------
type VariationStatus = 'potential' | 'under_review' | 'confirmed' | 'rejected';

interface CostLine {
  id: string;
  boqItemRef: string; description: string; unit: string;
  quantityDelta: number;               // + added, − omitted
  rate: number;                        // HK$ per unit
  rateSource: 'contract_boq' | 'forecast_adjusted' | 'manual';
  amount: number;                      // quantityDelta × rate
  materialId?: string;                 // links to forecasting
}

interface VariationEvent {
  id: string; projectId: string;
  ref: string;                         // 'VE-007'
  title: string;
  drawingNumber: string;
  sourceChangeIds: string[];
  comparisonId: string;
  status: VariationStatus;
  costLines: CostLine[];
  indicativeCost?: { total: number; low: number; high: number; basis: string };  // HK$
  raisedBy: string; raisedAt: ISODate;
  decision?: { status: 'confirmed' | 'rejected'; by: string; at: ISODate; reason: string };
}

// ---------- Excel integration ----------
type WorkbookKind = 'boq' | 'cost_plan' | 'valuation' | 'other';

interface ColumnMapping {
  sheet: string; headerRow: number;
  columns: { itemRef: string; description: string; unit: string; quantity: string; rate: string; amount: string; section?: string }; // Excel column letters
}

interface Workbook {
  id: string; projectId: string; documentId: string;   // every workbook is also a hub document
  name: string; kind: WorkbookKind;
  currentVersionId?: string;
  mapping?: ColumnMapping;
  updatedAt: ISODate;
}

interface WorkbookVersion {
  id: string; workbookId: string; versionNumber: number;
  fileName: string; sha256: string; sizeBytes: number;
  sheetNames: string[];
  status: 'parsing' | 'checking' | 'checked' | 'failed';
  checkSummary?: { errors: number; warnings: number; info: number };
  totals?: { sheet: string; amount: number }[];
  uploadedBy: string; uploadedAt: ISODate;
}

type CheckRule =
  | 'formula_error'        // #REF!, #DIV/0!, #VALUE!, #N/A
  | 'amount_mismatch'      // quantity × rate ≠ amount
  | 'sum_mismatch'         // section/collection total ≠ sum of lines
  | 'hardcoded_amount'     // amount typed as a value where neighbours use formulas
  | 'missing_rate' | 'missing_unit' | 'missing_quantity'
  | 'duplicate_item_ref'
  | 'rate_outlier'         // rate far from project/forecast reference
  | 'external_link';       // formula links to another workbook

interface WorkbookCheck {
  id: string; versionId: string;
  rule: CheckRule; severity: 'error' | 'warning' | 'info';
  sheet: string; cell: string;         // 'F124'
  itemRef?: string;
  message: string;                     // plain language: "Amount is HK$12,400 but quantity × rate is HK$14,200"
  expected?: string; actual?: string;
  status: 'open' | 'resolved' | 'ignored';
  resolution?: { by: string; at: ISODate; reason?: string };
}

interface BoqItem {
  id: string; workbookVersionId: string;
  sheet: string; row: number; section?: string;
  itemRef: string; description: string; unit: string;
  quantity: number | null; rate: number | null; amount: number | null;
  materialId?: string;
}

interface WorkbookDiff {
  baseVersionId: string; targetVersionId: string;
  summary: { added: number; removed: number; changed: number; totalDelta: number };
  rows: Array<{
    kind: 'added' | 'removed' | 'changed';
    sheet: string; row: number; itemRef: string; description: string;
    fields: Array<{ field: 'quantity' | 'rate' | 'amount' | 'description' | 'unit'; before: string | number | null; after: string | number | null }>;
  }>;
}

// ---------- material forecasting & procurement ----------
interface Material {
  id: string; code: string; name: string;   // 'High-tensile steel rebar'
  unit: string;                              // 'tonne', 'm³'
  category: 'steel' | 'concrete' | 'cement' | 'aggregate' | 'timber' | 'copper' | 'glass' | 'waterproofing' | 'other';
  source: string;                            // e.g. 'C&SD / CEDD monthly average wholesale prices'
  latestPrice: number; latestPeriod: Period;
  change3mPct: number;                        // vs 3 months ago
  trend: 'rising' | 'stable' | 'falling';     // forecast direction over next 6 months
}

interface PriceForecast {
  materialId: string;
  history: Array<{ period: Period; price: number }>;
  forecast: Array<{ period: Period; p50: number; p10: number; p90: number; p025: number; p975: number }>;
  model: { name: string; version: string; trainedThrough: Period; horizonMonths: number; backtestMapePct: number; drivers: string[] };
}

interface ProcurementAdvice {
  id: string; projectId: string; materialId: string;
  quantity: number; neededBy: ISODate; leadTimeWeeks: number;
  latestOrderDate: ISODate;                   // neededBy − lead time
  recommendation: 'buy_now' | 'buy_in_window' | 'no_clear_advantage';
  window?: { from: Period; to: Period };
  costIfBoughtNow: number;
  expectedCostInWindow?: number;
  expectedSaving?: number;                    // can be negative
  range: { low: number; high: number };       // expected cost range in window (p10–p90)
  confidence: 'low' | 'medium' | 'high';
  rationale: string[];                        // plain-language bullet points
  createdBy: string; createdAt: ISODate;
}

interface ProjectMaterialNeed {
  projectId: string; materialId: string;
  quantity: number; neededBy?: ISODate;
  source: 'boq' | 'variation' | 'manual';
  sourceRefs: string[];                       // BOQ item refs / VE refs
  exposureHKD: { p10: number; p50: number; p90: number }; // cost range at forecast prices
}

// ---------- audit ----------
interface AuditEvent {
  id: string; at: ISODate; actorId: string; actorRole: Role;
  action: string;                      // 'document.version_uploaded', 'change.marked_potential_variation', …
  entityType: 'project' | 'document' | 'document_version' | 'comparison' | 'change' | 'variation' | 'workbook' | 'workbook_version' | 'check' | 'procurement' | 'user';
  entityId: string; summary: string; details?: Record<string, unknown>;
}
```

### Endpoint response envelopes (approved 4 November 2026)

These supplement the entity contracts above; entity fields are unchanged.

```ts
interface ProjectOverview {
  counts: { documents: number; drawings: number; variations: number; workbooks: number; openChecks: number };
  recentActivity: AuditEvent[];
}
interface DrawingRegisterEntry { document: HubDocument; latestComparison?: DrawingComparison }
interface SheetPreview {
  sheet: string; fromRow: number; toRow: number;
  rows: Array<{ row: number; cells: Array<{ column: string; value: string | number | null; formula?: string }> }>;
}
```

`/projects/:projectId/overview` returns `ProjectOverview`; the drawings register returns `DrawingRegisterEntry[]`; the sheet-preview endpoint returns `SheetPreview`. Cursor-paginated item and audit lists return arrays with the next cursor in the `X-Next-Cursor` response header.

### REST endpoints (all under `/api/v1`)

```
GET    /me
GET    /projects                                   GET /projects/:projectId
GET    /projects/:projectId/overview               (counts + recent activity for the project home)

# Document hub
GET    /projects/:projectId/documents?category=&q=&discipline=&conflict=
POST   /projects/:projectId/documents              (multipart: file, category, docNumber, title, label, discipline?, issuedDate?)
GET    /documents/:documentId
GET    /documents/:documentId/versions
POST   /documents/:documentId/versions             (multipart: file, label, issuedDate?, notes?)
POST   /documents/:documentId/current              { versionId, reason }   (resolves conflicts)
GET    /documents/:documentId/conflicts
GET    /document-versions/:versionId/file
GET    /projects/:projectId/links?type=&id=

# Drawing revision analysis
GET    /projects/:projectId/drawings               (hub documents in category 'drawing' + latest comparison)
POST   /projects/:projectId/comparisons            { documentId, baseVersionId, targetVersionId }
GET    /comparisons/:comparisonId
PATCH  /comparisons/:comparisonId/alignment        { dx, dy, scale, rotationDeg }
GET    /comparisons/:comparisonId/changes?kind=&status=
PATCH  /changes/:changeId                          { status, note? }

# Variation events
GET    /projects/:projectId/variations?status=
POST   /projects/:projectId/variations             { title, sourceChangeIds, comparisonId }
GET    /variations/:variationId
PUT    /variations/:variationId/cost-lines         { costLines }
POST   /variations/:variationId/decision           { status, reason }

# Excel integration
GET    /projects/:projectId/workbooks
POST   /projects/:projectId/workbooks              (multipart: file, name, kind)
GET    /workbooks/:workbookId
POST   /workbooks/:workbookId/versions             (multipart: file)
PUT    /workbooks/:workbookId/mapping              { mapping }
GET    /workbook-versions/:versionId
GET    /workbook-versions/:versionId/checks?severity=&rule=&status=
PATCH  /checks/:checkId                            { status, reason? }
GET    /workbook-versions/:versionId/items?q=&section=&cursor=
GET    /workbook-versions/:versionId/sheet?sheet=&fromRow=&toRow=   (cell grid for preview)
GET    /workbooks/:workbookId/diff?base=&target=
GET    /workbook-versions/:versionId/download?annotated=true|false
GET    /projects/:projectId/boq-items?q=           (items from the current BOQ, for cost linking)

# Materials
GET    /materials?category=&q=
GET    /materials/:materialId/forecast
GET    /projects/:projectId/material-needs
GET    /projects/:projectId/procurement
POST   /projects/:projectId/procurement            { materialId, quantity, neededBy, leadTimeWeeks }  → ProcurementAdvice

# Audit
GET    /projects/:projectId/audit-events?entityType=&entityId=&actorId=&from=&to=&cursor=
```

### WebSocket events

```ts
type WsEvent =
  | { type: 'comparison.progress'; comparisonId: string; status: DrawingComparison['status']; progressPct: number }
  | { type: 'comparison.completed'; comparisonId: string; status: 'succeeded' | 'failed'; changeCount: number }
  | { type: 'document.version_added'; documentId: string; versionId: string; conflict: boolean }
  | { type: 'workbook.checked'; workbookId: string; versionId: string; checkSummary: WorkbookVersion['checkSummary'] };
```

WS events update the TanStack Query cache via `useProjectEvents(projectId)`. Components never subscribe to the socket directly.

---

## 8. Project structure

```
src/
  app/
    [locale]/
      (auth)/login/
      (app)/
        projects/                                   # portfolio
        projects/[projectId]/
          overview/                                 # project home
          documents/                                # hub register
          documents/[documentId]/                   # versions, preview, conflicts, links
          drawings/                                 # drawing register
          drawings/compare/[comparisonId]/          # comparison viewer
          variations/                               # variation event register
          variations/[variationId]/
          workbooks/
          workbooks/[workbookId]/                   # versions, checks, preview, diff
          procurement/                              # project materials + advice
          audit/
        materials/                                  # market materials list
        materials/[materialId]/                     # forecast + timing planner
        admin/
  components/
    ui/          # primitives (from shadcn / 21st.dev, restyled)
    charts/      # ECharts wrappers + theme
    grid/        # virtualized table + spreadsheet grid building blocks
    viewer/      # drawing canvas, overlay compositor, revision cloud, sync pan/zoom
    layout/      # AppShell, Header, LeftNav, DetailDrawer
  features/
    documents/  drawings/  variations/  workbooks/  materials/  procurement/  audit/  overview/  admin/
      └─ each: components/, hooks/, api.ts, index.ts
  lib/
    api/   ws/   auth/   format/   config/
  schemas/
  mocks/
    handlers/    ws/    fixtures/
public/mock-files/   # sample drawing revisions (PDF/PNG) and .xlsx workbooks
messages/en.json  messages/zh-HK.json
tests/e2e/
```

Features import from `components/`, `lib/`, `schemas/` and other features' `index.ts` only. No business logic in `app/` route files beyond composition and data loading.

---

## 9. Design system

**Read `DESIGN.md` before any UI work.** Rules most often broken:

- Theme tokens only — no raw Tailwind palette colours (`zinc-*`, `slate-*`, `blue-*`…) and no hex values in components. Revision overlay colours come from `--rev-base` / `--rev-target` tokens.
- Font is **Karla** (Chinese: Noto Sans HK). Karla's default digits are proportional, so every number uses `tabular-nums` and is **right-aligned** in tables. Never use a monospace face for data.
- Sentence case everywhere; no all-caps labels.
- Brand colours (Clay, Sandstone, Limewash, Lichen) are never text on light backgrounds.

### Formatting (all through `src/lib/format`)

- Currency: `Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' })`; compact for summaries (`HK$186.4k`, `HK$1.2M`).
- Unit prices always carry the unit: `HK$6,850 / tonne`.
- Ranges: `HK$171k – HK$203k` (en dash with spaces). Percent change: signed, one decimal, true minus sign: `+4.2%`, `−1.8%`.
- Periods: `Feb 2027` (en), `2027年2月` (zh-HK). Dates locale-aware.
- File sizes: `2.4 MB`. Revision labels shown as `Rev C`.

---

## 10. UX rules (non-negotiable)

1. **Assist, don't decide.** Detected changes start as `new`; only a person marks them. Only `senior_qs` confirms or rejects a variation event. AI-written text (change summaries, forecast drivers, advice rationale) carries an "AI-generated" label.
2. **Every number shows its basis.** Indicative costs list their cost lines and rate sources. Forecasts show model name, trained-through period and backtest error. Procurement advice lists its rationale.
3. **Ranges, not points.** Indicative cost always shows low–high. Forecasts always show bands. Never present a single forecast number without its range.
4. **One current version.** Exactly one version per document is "Current". Superseded versions show a persistent "Superseded — Rev C is current" banner with a link. Conflicts block "set current" until a `senior_qs` resolves them with a reason.
5. **Nothing is deleted.** Versions can be superseded, checks ignored, changes marked no-variation — but every action is reversible or logged. No hard-delete controls in the UI.
6. **Traceability is clickable.** A variation event links to its drawing changes; a change links to both revisions; a cost line links to the BOQ row and the workbook version; a material need links to BOQ items or VEs. Use `EntityLink` and a shared "Linked records" panel.
7. **Async by default.** Comparisons and workbook checks run in the background with visible progress; users can leave and come back; a toast announces completion.
8. **Excel stays the editor.** Smart QS never edits workbook cells. It shows, checks, compares and downloads. The "Open in Excel" action downloads the current version (annotated optional).
9. **Low confidence is visible.** Changes below 0.6 confidence and alignment quality below 0.8 are marked "Low confidence — check visually". Forecasts with `confidence: 'low'` say so before the recommendation.
10. **Empty and error states give direction**, and buttons say what they do ("Compare revisions", "Raise potential variation", "Upload new version").

### Copy rules

The product forecasts and flags; it never promises. **Banned in user-facing strings** (both locales): `guaranteed`, `certainly`, `will definitely`, `risk-free`, `100% accurate`, `fraud`, `fraudulent`.
Use: *forecast, likely range, indicative, potential variation, requires review, expected saving*.

`tests/copy.test.ts` scans `messages/*.json` and fails on banned words. Every key must exist in both `en.json` and `zh-HK.json` (placeholder `"[TODO zh-HK] …"` allowed until Task 11).

---

## 11. Performance and accessibility

- Drawing viewer: render pages to canvas at device pixel ratio, re-render on zoom settle (debounce 150 ms); keep pan/zoom at 60 fps on an A1 sheet; synced viewers share one transform.
- Spreadsheet preview and BOQ tables virtualize rows and stay smooth at **5,000 rows**.
- Charts and the PDF renderer load client-side only (`dynamic(..., { ssr: false })`) inside fixed-height containers.
- WCAG 2.1 AA: keyboard pan (arrow keys), zoom (`+`/`-`), next/previous change (`J`/`K`), `Esc` closes drawers with focus returned; `aria-live="polite"` for job progress; respect `prefers-reduced-motion`.
- Every chart and the drawing viewer have a text alternative (change list / data table).
- Desktop-first (≥1280px); tablet usable for viewing; mobile read-only.

---

## 12. Mock data (fixtures)

Deterministic (seeded PRNG, never bare `Math.random()`), in `src/mocks/fixtures`, files in `public/mock-files/`:

- **Project `P-001` "Central Market Rehab Phase 2"**, users for every role, dev-only role switcher in the header when mocking.
- **Hub:** ~40 documents across all five categories. Includes a conflict on `CON-004` (two files labelled Rev 2) and a duplicate upload.
- **Drawings:** `A-201` "Level 2 floor plan" with Rev A, B, C as real PDFs (or PNGs) in `public/mock-files/drawings/`, where Rev B → Rev C has **4 known changes** whose `bbox` match the actual differences: (1) slab opening enlarged (`modified`), (2) new beam added (`added`), (3) partition wall removed (`removed`), (4) dimension 3,600 → 4,200 (`dimension`). Also `S-110` with Rev P1 → P2 and 2 changes. Make the PDFs simple vector drawings generated by a script in `scripts/make-mock-drawings.ts` so the differences are exact.
- **Variation events:** `VE-007` (from A-201 changes 1–2, `potential`, cost lines totalling **HK$186,400**, range HK$171,000–203,000, includes 4.2 t rebar), plus 5 others across statuses.
- **Workbooks:** `public/mock-files/workbooks/boq-v1.xlsx` and `boq-v2.xlsx` (~600 rows, realistic trades: preliminaries, concrete repair, reinforcement, waterproofing, external walls, windows, drainage, fire services, E&M). v2 contains: 3 added rows (VE-007 items), 2 changed rates, 1 `#REF!`, 1 amount mismatch, 1 sum mismatch, 1 duplicate item ref. MSW parses these with `exceljs` and runs simple versions of the checks, so uploading either file in the demo produces real results.
- **Materials:** 10 materials (rebar, structural steel, ready-mixed concrete C35, cement, aggregate, timber formwork, copper cable, float glass, waterproofing membrane, diesel) with 60 months of history and a 12-month forecast. Rebar forecast rises ~6% over 6 months with widening bands; recommended window Feb–Mar 2027.
- **Procurement:** advice for rebar (`buy_in_window`), concrete (`no_clear_advantage`), copper cable (`buy_now`).
- **Audit:** events covering the full demo story in §2.
- MSW WS handler simulates a comparison (~10 s: queued → aligning → detecting → succeeded) and a workbook check (~5 s).

---

## 13. Commands

```
npm install            # install dependencies
npm run dev            # next dev (mocks on if NEXT_PUBLIC_API_MOCKING=enabled)
npm run build
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # vitest
npm run test:e2e       # playwright
npm run mock:files     # regenerate mock drawings and workbooks
```

---

## 14. How to work (agent behaviour)

1. **Plan first.** Reply with a short plan, files to create/modify, new dependencies with justification, and assumptions. Wait for approval on anything that changes contracts, adds dependencies, or touches more than one feature folder.
2. **Small vertical slices.** One feature per change; don't refactor unrelated code.
3. **Contracts are sacred.** Propose contract changes; never invent fields silently.
4. **Ask instead of guessing** on QS workflow, wording or thresholds. Record decisions in `docs/decisions.md`.
5. **Never weaken §10** to make a task easier.
6. End every UI task's plan with the `DESIGN.md` §13 slop smell test.

### Definition of done (every task)

- [ ] `npm run typecheck`, `npm run lint`, `npm test` pass; no new console errors/warnings
- [ ] API data parsed with Zod; loading, empty, error and low-confidence states implemented
- [ ] Permissions via `can()`; checked as `senior_qs`, `qs` and `viewer`
- [ ] Strings in `en.json` and `zh-HK.json`; copy test passes
- [ ] Keyboard navigable; status never shown by colour alone
- [ ] Tests added for logic, formatters and interactive components
- [ ] Short summary: what changed, files touched, assumptions, follow-ups

---

## 15. Out of scope (dropped — do not build)

Tender evaluation, bid comparison, contractor compliance/credit scores, news sentiment, fraud or collusion detection, owner voting portal, report sign-off certificates · **automated quantity take-off** from drawings · measuring tools on drawings · BIM/3D models · editing Excel cells inside Smart QS · formal VO issuing and final accounts · site scheduling and attendance · payment certification · purchasing or placing orders with suppliers · legal or contractual advice.

## 16. Open product questions (use the default until answered)

| Question | Default for now |
|---|---|
| Cost link for drawing changes | **QS-assisted indicative cost** (QS picks BOQ items, enters quantity changes; system multiplies by contract rates) — see `PRODUCT_BRIEF.md` §2 |
| Excel integration depth | Upload / check / diff / download round-trip in the web app; Office.js Excel add-in is a stretch goal |
| Which material price source | C&SD / CEDD monthly average wholesale prices of selected building materials |
| Forecast horizon | 12 months, monthly |
| Change confidence threshold | 0.6 (below = "Low confidence") |
| Rate outlier threshold for workbook checks | ±30% from project median for the same unit and trade |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
