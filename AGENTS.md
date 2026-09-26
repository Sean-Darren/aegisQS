# AGENTS.md — Smart QS (AegisQS) Front-End

> Persistent context for AI coding agents (Codex, Claude Code, Cursor, etc.).
> Read this file fully before every task. If a task prompt conflicts with this file, stop and ask.

---

## 1. Product in one paragraph

Smart QS (codename **AegisQS**) is an AI-assisted **independent cost-audit platform for Quantity Surveyors (QS)** working on Hong Kong building-rehabilitation projects. A QS uploads tender documents (priced BOQs, AP/RSE inspection reports, tender qualifications, VO claims). A backend AI pipeline analyses them asynchronously and returns **flags with cited evidence** plus a **0–100 Compliance Score per bid**. A named Senior QS reviews every flag, then signs off a version-locked **Tender Assessment Report / PDF certificate** that can be shared read-only with building owners (Owners' Corporations).

**It is decision support. It is NOT a fraud determination, NOT a site inspection, and NOT a BOQ authoring or estimating tool.** Every UI decision must respect that.

Core loop the UI is built around:

```
Upload → Async AI analysis → Flags with evidence → Human review → Signed, traceable report
```

---

## 2. Domain glossary (use these terms consistently in code and UI)

| Term | Meaning |
|---|---|
| QS | Quantity Surveyor |
| BOQ | Bill of Quantities — line items (item ref, description, unit, quantity, rate) |
| Priced BOQ | A tenderer's BOQ with their rates filled in |
| AP / RSE | Authorized Person / Registered Structural Engineer — author of inspection reports |
| Tenderer | A contractor submitting a bid |
| Bid | One tenderer's submission for one project |
| Provisional Sum (PS) | Money reserved for undefined work; high concentration is a risk signal (threshold 15% of bid) |
| VO | Variation Order — post-award change to scope/cost |
| TPI | Tender Price Index (RLB / ArchSD) used for benchmarking |
| OC | Owners' Corporation — building owners who vote on the award |
| Flag | An anomaly the AI raises, always with evidence and a confidence score |
| Disposition | A human decision on a flag: accept, dismiss, or escalate (with reason) |
| Compliance Score | 0 (critical risk) to 100 (ultra-low risk), per **bid**, from seven weighted signals |
| z-score / σ | Standard deviations from the HK benchmark; ±2.0σ is the predatory-pricing threshold |

### The seven Compliance Score signals

`rate_anomalies`, `provisional_sum_concentration`, `qs_benchmark_variance`, `scope_ambiguity`, `unresolved_clarifications`, `tender_qualifications`, `news_sentiment_12m`

### Risk bands (placeholder — keep in config, never hard-code in components)

| Band | Score range |
|---|---|
| Low | 80–100 |
| Moderate | 60–79 |
| High | 40–59 |
| Critical | 0–39 |

---

## 3. Users and permissions

| Role key | Who | Can | Cannot |
|---|---|---|---|
| `senior_qs` | Lead QS, signatory | Everything in a project; finalize dispositions; override recommendation; sign off; share with owners | Admin settings |
| `junior_qs` | Assistant QS | Upload, run analysis, annotate, **propose** dispositions | Finalize dispositions, sign off, share |
| `owner_viewer` | OC member | View **signed** reports and their evidence, read-only | See drafts, open flags, edit anything |
| `admin` | Org admin | Users/roles, scoring config, data-source health, audit log | Sign off reports (unless also `senior_qs`) |

**Contractors are never users.** No contractor-facing screens.

Implement permissions as a single map in `src/lib/auth/permissions.ts` and a `can(user, permission, resource?)` helper. Components must call `can()` — never compare role strings inline.

```ts
export const PERMISSIONS = {
  'project.view':        ['senior_qs', 'junior_qs', 'admin'],
  'document.upload':     ['senior_qs', 'junior_qs'],
  'analysis.run':        ['senior_qs', 'junior_qs'],
  'flag.comment':        ['senior_qs', 'junior_qs'],
  'flag.propose':        ['senior_qs', 'junior_qs'],
  'flag.finalize':       ['senior_qs'],
  'report.sign':         ['senior_qs'],
  'report.share':        ['senior_qs'],
  'report.viewSigned':   ['senior_qs', 'junior_qs', 'owner_viewer', 'admin'],
  'admin.manage':        ['admin'],
} as const;
```

The UI hides or disables actions per permission, but **the backend is the real enforcement point**. Never assume UI gating is security.

---

## 4. Tech stack (do not substitute without asking)

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript `strict: true` |
| Package manager | pnpm |
| Styling | Tailwind CSS with design tokens as CSS variables (see §8) |
| UI primitives | Radix UI (via shadcn/ui-style local components in `src/components/ui`) |
| Server state | TanStack Query |
| Data grid | TanStack Table + TanStack Virtual |
| Charts | Apache ECharts via `echarts-for-react` |
| PDF evidence viewer | `react-pdf` (PDF.js) with a custom bounding-box overlay |
| Schemas / validation | Zod — every API response is parsed through a Zod schema |
| Forms | React Hook Form + Zod resolver |
| i18n | `next-intl`, locales `en` and `zh-HK` (Traditional Chinese) from day one |
| Mock backend | MSW 2.x (HTTP + WebSocket handlers) |
| Unit / component tests | Vitest + Testing Library |
| E2E | Playwright |
| Lint / format | ESLint + Prettier |

Adding any dependency not listed above requires a one-line justification in your plan and user approval.

---

## 5. System context (what the front end talks to)

- **Backend API gateway**: REST under `/api/v1`, JWT auth via **httpOnly cookie** set by the backend. Never store tokens in `localStorage`/`sessionStorage`.
- **WebSocket server**: pushes job progress and new flags.
- **Redis result cache** (backend): serves precomputed rate matrices and heatmaps — treat grid endpoints as paginated/cursor-based.
- **AI pipeline** (backend, not our concern): runs 4 auditors per tenderer — `scope_completeness`, `rate_variation`, `provisional_sum`, `reference_resolver`. Takes minutes. Every result carries `modelVersion` and `toolSchemaVersion`.
- Until the real backend is ready, **everything runs against MSW mocks**. Toggle via `NEXT_PUBLIC_API_MOCKING=enabled`.

---

## 6. Data contracts (source of truth)

Live in `src/schemas/*.ts` as Zod schemas; types are inferred with `z.infer`. The shapes below are the contract. **Do not change a contract without updating schemas, mocks, and fixtures in the same change and calling it out in your summary.**

```ts
type Role = 'senior_qs' | 'junior_qs' | 'owner_viewer' | 'admin';
type ProjectStage = 'pre_tender' | 'tender' | 'post_award';
type Severity = 'critical' | 'high' | 'medium' | 'low';
type RiskBand = 'low' | 'moderate' | 'high' | 'critical';
type AuditorKind = 'scope_completeness' | 'rate_variation' | 'provisional_sum' | 'reference_resolver';
type SignalKey =
  | 'rate_anomalies' | 'provisional_sum_concentration' | 'qs_benchmark_variance'
  | 'scope_ambiguity' | 'unresolved_clarifications' | 'tender_qualifications'
  | 'news_sentiment_12m';

interface User { id: string; name: string; email: string; role: Role; locale: 'en' | 'zh-HK'; }

interface Project {
  id: string; code: string; name: string;           // e.g. "Central Market Rehab Phase 2"
  stage: ProjectStage; createdAt: string;            // ISO 8601
  tendererCount: number; latestJobId?: string;
}

interface Tenderer {
  id: string; projectId: string; name: string;
  devbRegistered: boolean; companyRegistryMatched: boolean;
  activeLitigationCount: number; adversePressFlags: number;
}

type DocumentType =
  | 'draft_boq' | 'priced_boq' | 'inspection_report' | 'tender_qualification'
  | 'clarification_log' | 'site_photo' | 'vo_claim' | 'payment_claim';

interface ProjectDocument {
  id: string; projectId: string; tendererId?: string;
  type: DocumentType; fileName: string; version: number; pageCount?: number;
  parseStatus: 'queued' | 'parsing' | 'parsed' | 'failed'; parseError?: string;
  uploadedBy: string; uploadedAt: string;
}

interface AnalysisJob {
  id: string; projectId: string;
  status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
  startedAt: string; finishedAt?: string;
  progress: Array<{ tendererId: string; auditor: AuditorKind; status: 'queued'|'running'|'succeeded'|'failed'; pct: number; error?: string }>;
  modelVersion: string; toolSchemaVersion: string;
}

interface Bid {
  id: string; projectId: string; tendererId: string;
  totalValueHKD: number; provisionalSumHKD: number;
}

interface SignalContribution {
  signal: SignalKey; weight: number;          // weights sum to 1 in static mode
  rawValue: number; contribution: number;     // points contributed to the 0–100 score
  dataSufficient: boolean;                    // false => show "Insufficient benchmark data"
}

interface ComplianceScore {
  bidId: string; tendererId: string; projectId: string;
  score: number; band: RiskBand;
  signals: SignalContribution[];
  scoringMode: 'static' | 'ml'; configVersion: string; computedAt: string;
}

interface Evidence {
  id: string; documentId: string;
  page?: number; boqItemRef?: string;
  bbox?: { x: number; y: number; w: number; h: number };   // normalised 0–1 on the page
  excerpt: string;
  calculation?: { expression: string; inputs: Record<string, number>; result: number };
}

interface FlagDecision { action: 'accept' | 'dismiss' | 'escalate'; by: string; at: string; reason: string; }

interface Flag {
  id: string; projectId: string; tendererId?: string;
  auditor: AuditorKind; signal: SignalKey; severity: Severity;
  confidence: number;                          // 0–1
  title: string; description: string;
  boqItemRef?: string; zScore?: number;
  threshold?: { kind: 'sigma' | 'percent'; value: number };
  evidence: Evidence[];                        // ALWAYS length >= 1
  status: 'open' | 'proposed' | 'accepted' | 'dismissed' | 'escalated';
  proposal?: FlagDecision;                     // set by junior_qs
  decision?: FlagDecision;                     // set by senior_qs (final)
  assigneeId?: string; createdAt: string;
}

interface RateGridRow {
  boqItemRef: string; description: string; trade: string; unit: string; quantity: number;
  benchmarkRate?: number; benchmarkSufficient: boolean;
  rates: Record<string /* tendererId */, { rate: number | null; zScore?: number; flagId?: string }>;
}
interface RateGridPage { rows: RateGridRow[]; nextCursor?: string; totalRows: number; }

interface PriceDistribution {
  benchmarkMeanHKD: number; benchmarkSigmaHKD: number;
  points: Array<{ tendererId: string; totalValueHKD: number; sigma: number; withinTolerance: boolean }>;
  thresholdSigma: number;                      // default 2.0
}

interface ProjectKpis {
  avgRateVarianceZ: number; highRiskBidCount: number; totalBidCount: number;
  recommendedTendererId?: string; benchmarkDataAsOf: string;
}

interface ScopeGap {
  id: string; projectId: string;
  finding: { ref: string; text: string; documentId: string; page: number };
  mappedBoqItemRef?: string;
  status: 'mapped' | 'vague' | 'missing' | 'oversized_ps';
  flagId?: string;
}

interface Report {
  id: string; projectId: string; version: number;
  status: 'draft' | 'signed';
  signedBy?: string; signedAt?: string;
  recommendedTendererId?: string; overrideReason?: string;
  modelVersion: string; toolSchemaVersion: string; benchmarkDataAsOf: string;
  pdfUrl?: string;
}

interface AuditEvent {
  id: string; at: string; actorId: string; actorRole: Role;
  action: string; entityType: 'project'|'document'|'job'|'flag'|'report'|'config'|'user';
  entityId: string; details?: Record<string, unknown>;
}
```

### REST endpoints (all under `/api/v1`)

```
GET    /me
GET    /projects
GET    /projects/:projectId
GET    /projects/:projectId/documents
POST   /projects/:projectId/documents              (multipart; fields: file, type, tendererId?)
POST   /projects/:projectId/analysis-jobs
GET    /analysis-jobs/:jobId
GET    /projects/:projectId/tenderers
GET    /projects/:projectId/bids
GET    /projects/:projectId/kpis
GET    /projects/:projectId/scores
GET    /projects/:projectId/price-distribution
GET    /projects/:projectId/rate-grid?cursor=&trade=&flaggedOnly=
GET    /projects/:projectId/flags?severity=&status=&tendererId=&auditor=&signal=
GET    /flags/:flagId
POST   /flags/:flagId/proposal                     { action, reason }
POST   /flags/:flagId/decision                     { action, reason }
GET    /projects/:projectId/scope-gaps
GET    /projects/:projectId/reports
POST   /projects/:projectId/reports                (sign-off; { recommendedTendererId, overrideReason? })
GET    /projects/:projectId/audit-events?cursor=
GET    /documents/:documentId/file                 (returns the PDF / file)
```

### WebSocket events (`/ws?projectId=...`)

```ts
type WsEvent =
  | { type: 'job.progress'; jobId: string; tendererId: string; auditor: AuditorKind; status: string; pct: number }
  | { type: 'job.completed'; jobId: string; status: AnalysisJob['status'] }
  | { type: 'flag.created'; flag: Flag };
```

WS events must update the TanStack Query cache (`setQueryData` / `invalidateQueries`) — components never subscribe to the socket directly; use `useProjectEvents(projectId)`.

---

## 7. Project structure

```
src/
  app/
    [locale]/
      (auth)/login/
      (app)/
        projects/                         # portfolio
        projects/[projectId]/
          overview/
          documents/
          pre-tender/scope-gaps/
          tender/risk/  tender/scope/  tender/rates/  tender/boq/
          flags/
          reports/
          audit/
        admin/
      (owner)/shared/[token]/             # read-only owner portal
  components/
    ui/                                   # primitives (button, dialog, drawer, tabs, badge…)
    charts/                               # ECharts wrappers
    grid/                                 # virtualized table building blocks
    layout/                               # AppShell, Header, StageStepper, LeftNav, EvidenceDrawer
  features/
    documents/  jobs/  tender-overview/  scores/  rate-grid/
    flags/  evidence/  scope-gaps/  reports/  audit/  admin/
      └─ each: components/, hooks/, api.ts, index.ts
  lib/
    api/        # fetch client, error handling, query keys
    ws/         # socket client + useProjectEvents
    auth/       # permissions.ts, session hook
    format/     # currency, number, date, sigma formatting
    config/     # risk bands, thresholds (from API later)
  schemas/      # Zod schemas = contracts
  mocks/
    handlers/   # MSW HTTP handlers per resource
    ws/         # MSW WebSocket handlers (simulated job progress)
    fixtures/   # deterministic seed data
  messages/
    en.json
    zh-HK.json
tests/e2e/      # Playwright
```

Rules: features import from `components/`, `lib/`, `schemas/` — never from another feature's internals (use its `index.ts`). No business logic in `app/` route files beyond composition and data loading.

---

## 8. Design system

### Palette (CSS variables in `src/app/globals.css`, exposed to Tailwind)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0E1A2B` | Primary text, dark panels (recommended-awardee card, distribution chart background) |
| `--surface` | `#F3F5F4` | App background |
| `--panel` | `#FFFFFF` | Cards, tables |
| `--tolerance` | `#15935F` | Within tolerance / low risk |
| `--caution` | `#C77D0A` | Moderate risk, medium severity |
| `--risk` | `#D93A3F` | High/critical risk, breached thresholds |
| `--steel` | `#4A6378` | Secondary text, gridlines, neutral chart series |

Provide a dark theme later; build with tokens so it is a token swap.

### Typography

- Latin: **IBM Plex Sans** (fits the engineering/industrial subject; strong tabular figures). Chinese fallback: **Noto Sans HK**.
- All numbers in tables, KPI cards, and charts use `font-variant-numeric: tabular-nums` and are **right-aligned**. Do not switch to a monospace face for data.
- Sentence case for all labels, buttons, headings. No all-caps eyebrow labels.

### Formatting (all through `src/lib/format`)

- Currency: `Intl.NumberFormat('en-HK', { style: 'currency', currency: 'HKD' })`; compact form for KPIs (`HK$142.8M`).
- Unit rates always show the unit: `HK$1,250.00 / m²`.
- Sigma: signed, one decimal: `−2.4σ`, `+0.4σ` (use the true minus sign `−`).
- Percent: one decimal. Dates: locale-aware, show "as of" dates for benchmark data.

### Severity and risk — never colour alone

Every severity/band indicator = colour + icon + text label (e.g. red + warning icon + "High risk"). This is required for colour-blind users.

---

## 9. UX rules (non-negotiable)

1. **Evidence first.** Every flag, chart point, and grid cell with a flag is clickable and opens the **Evidence Drawer** (right side, does not navigate away). The drawer shows: source document page with bbox highlight, excerpt, calculation trace, confidence, disposition controls.
2. **No flag without evidence.** If a flag arrives with an empty `evidence` array, render it in an error state ("Evidence missing — report to admin") and exclude it from the sign-off count.
3. **Human-in-the-loop.** Dispositions require a reason (min 10 chars). Sign-off is disabled until every `critical` and `high` flag has a final `decision`. Show the blocking count on the disabled button's tooltip.
4. **Provenance on every report and report preview**: signatory, signed date, `modelVersion`, `toolSchemaVersion`, `benchmarkDataAsOf`, and the disclaimer string `report.disclaimer`.
5. **Insufficient data is a state, not a zero.** When `dataSufficient`/`benchmarkSufficient` is false, show "Insufficient benchmark data" instead of a number or colour.
6. **Async by default.** Analysis never blocks the UI. Show per-tenderer × per-auditor progress in the header indicator and on the Documents page. Users can navigate away; show a toast when done. Failed auditors can be retried individually.
7. **Thresholds are visible.** Any chart that drives a flag draws the threshold it tests (±2σ band, 15% PS line).
8. **AI-written text is labelled** ("Generated by AegisQS — review before sign-off") and editable in draft reports.
9. **Stage-based navigation**: Pre-Tender → Tender → Post-Award stepper in the header; Tender stage has tabs **Risk · Scope · Rates · BOQ** (matches the existing mockup).
10. **Empty and error states give direction.** Say what happened and what to do next ("No tender documents yet. Upload each tenderer's priced BOQ to start."). Errors never apologise and are never vague.
11. **Buttons say what they do** and the name stays consistent through the flow ("Sign off report" → toast "Report signed").

### Language rules for UI copy

The product raises anomalies; it never accuses. **Banned in any user-facing string** (both locales): `fraud`, `fraudulent`, `corrupt`, `corruption`, `rigged`, `collusion`, `criminal`, `guilty`, `scam`.
Use instead: *flag, anomaly, outside tolerance, requires review, potential coordinated pricing, adverse press mention.*

A unit test (`tests/copy.test.ts`) must scan `messages/*.json` and fail on banned words. Keep it passing.

All user-facing strings go through `next-intl`. **No hard-coded UI strings in components.** Every new key must exist in both `en.json` and `zh-HK.json` (use a clearly marked English placeholder in zh-HK if a translation is not available: `"[TODO zh-HK] ..."`).

---

## 10. Performance and accessibility

- Rate grid must stay smooth at **5,000 rows × 12 tenderers**: virtualize rows, freeze `boqItemRef` + `description` columns, group columns by tenderer, memoize cell renderers.
- Charts load client-side only (`dynamic(..., { ssr: false })`); wrap in a fixed-height container to avoid layout shift.
- WCAG 2.1 AA: visible focus rings, full keyboard navigation in grid and drawer (Esc closes drawer, focus returns to trigger), `aria-live="polite"` for job progress, respects `prefers-reduced-motion`.
- Desktop-first (≥1280px); tablet (≥768px) fully usable for the Overview and Owner portal; mobile read-only.

---

## 11. Mock data (fixtures)

Deterministic seed in `src/mocks/fixtures` (use a seeded PRNG, never `Math.random()` directly):

- Project `P-001` "Central Market Rehab Phase 2", stage `tender`, 12 tenderers.
- Tenderers include **"BuildCorp HK Ltd."** (score 94.2, low risk, bid HK$142.8M, clean litigation, VO risk moderate) and **"Apex Foundations"** (score 41.8, high risk, bid HK$118.4M, 3 active litigations, 2 adverse press flags, −2.4σ). All names are fictional.
- Exactly **3** tenderers breach ±2.0σ; KPI `avgRateVarianceZ = 0.42`.
- ~3,000 BOQ rows across trades (preliminaries, concrete repair, waterproofing, external walls, windows, drainage, fire services, E&M), with ~5% flagged and some rows `benchmarkSufficient: false`.
- At least one sample PDF in `public/mock-docs/` for the evidence viewer, with flags whose `bbox` points at real text on it.
- Users for each role; a dev-only role switcher in the header when mocking is enabled.
- MSW WS handler simulates a job: progress ticks over ~20s, emits a few `flag.created` events, then `job.completed`.

---

## 12. Commands

```
pnpm dev            # next dev (mocks on if NEXT_PUBLIC_API_MOCKING=enabled)
pnpm build
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm test           # vitest
pnpm test:e2e       # playwright
```

---

## 13. How to work (agent behaviour)

1. **Plan first.** Before writing code, reply with: a short plan, the files you will create/modify, any new dependency with justification, and any assumption. Wait for approval on anything that changes contracts, adds dependencies, or touches more than one feature folder.
2. **Small, vertical slices.** One feature per change. Don't refactor unrelated code.
3. **Contracts are sacred.** If the UI needs data not in §6, propose the contract change; don't invent fields silently.
4. **Ask instead of guessing** on domain questions (QS workflow, thresholds, wording). Record decisions in `docs/decisions.md`.
5. **Never** weaken the rules in §9 to make a task easier.

### Definition of done (every task)

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass; no new console errors/warnings in dev
- [ ] All API data parsed via Zod; loading, empty, error, and insufficient-data states implemented
- [ ] Permissions enforced via `can()`; verified with at least `senior_qs` and `junior_qs`
- [ ] All strings in `en.json` and `zh-HK.json`; banned-word test passes
- [ ] Keyboard navigable; severity never shown by colour alone
- [ ] Tests added: unit tests for logic/formatters, component tests for interactive pieces
- [ ] Short summary: what changed, files touched, assumptions, follow-ups

---

## 14. Out of scope (do not build)

Site scheduling or attendance tracking · physical inspection tools · structural engineering calculations · legal drafting · contractor portal · BOQ authoring/editing · cost estimation from scratch.

## 15. Open product questions (use the stated default until answered)

| Question | Default for now |
|---|---|
| Score per bid or per contractor? | Per **bid** ("Compliance Score") |
| Risk band cut-offs | §2 table, from config |
| Owner access model | Expiring share-link token (`/shared/[token]`), no login |
| Weight changes after reports are signed | Signed reports are immutable; show the `configVersion` they used |
| Consultant-fee benchmarking | Not in scope yet |