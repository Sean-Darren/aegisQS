# Project decisions

## 2026-09-26

- Use the existing Next.js 16 App Router starter, strict TypeScript, and npm.
- Prefix every application route with en or zh-HK. The root defaults to en regardless of browser language.
- Keep product routes and feature modules as empty placeholders; no product workflows or contract changes are included.
- Enable browser mocks only with NEXT_PUBLIC_API_MOCKING=enabled. Vitest sets the same flag and uses the shared handlers through MSW's Node server.
- Use a deterministic sample /me response to verify mock infrastructure against the existing User contract.
- Vitest runs Node tests; Playwright covers rendering and browser behavior. Testing Library is installed for subsequent component work; no additional DOM environment dependency is introduced.
- Defer shadcn/21st.dev component installation until product UI is implemented.
- Use Vitest 4, which installs its Vite runtime dependency transitively; Vitest 5 required a separately installed runtime.

## 2026-09-28 — Contracts and mock backend

- Implement the §6 contracts without adding product fields. BuildCorp's moderate VO-risk label is scenario metadata because neither Bid nor ComplianceScore defines a VO-risk field.
- Lists return arrays except the already-defined RateGridPage. Audit cursor pagination returns AuditEvent[] with X-Next-Cursor; no new wire envelope is introduced. Mock page size is 100. Cursor tokens are bound to their resource and filters.
- Fixture generation uses a fixed seed and timestamp. It produces 3,000 rows, exactly 150 initially flagged rows (5%), 12 tenderers, and three price-distribution breaches. All 150 flags cite verified text boxes in a ten-page fictional sample PDF.
- Percent formatter inputs are fractions. Dates display in Asia/Hong_Kong. A signed one-decimal sigma normalizes rounded negative zero to +0.0σ.
- Share one in-memory store between HTTP mutations and WebSocket events. Jobs start through POST, advance for 20 seconds without a connected client, and publish 48 auditor progress entries plus three new flags. Mock resets clear every timer and connection.
- Mock roles are selected through a test/dev helper, not a new auth endpoint or browser-stored token. Enforce permissions on HTTP actions and project sockets. UI and role-switcher work remain out of scope.
- Sign-off blocks unresolved high/critical flags and running jobs. Signed metadata versions and their existing flag decisions are locked; later jobs may add new flags. Report PDF generation is deferred and pdfUrl is omitted. No report fields are invented to resolve the separate configVersion/disclaimer questions in AGENTS.md.
- Preserve the user's AegisQS wording in zh-HK; repair the existing Mock key names to loading/error so the current provider and locale-parity test work. Update the smoke-test paragraph locator to tolerate identical heading/body text.
- No application dependencies were added and no commits were created.

## 2026-09-28 — Design foundation and app shell

- Use the six explicitly approved packages (`radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `jsdom`) for accessible primitives, iconography, class composition, and component tests. Remove the shadcn CLI's unapproved `cn` package after localizing its helper.
- Adapt nine shadcn Radix primitives into Smart QS tokens. The 21st.dev catalog search was unavailable without sign-in; no third-party catalog code or repository design context was transmitted.
- Keep the header job and notification controls as named placeholders. Project route bodies are composition-only placeholders because product screens are outside this task.
- Use the existing mock role helper for dev-only role switching and invalidate TanStack Query state on every switch; the backend remains authoritative for permissions.
- Treat `?evidence=<flagId>` as the global drawer address. This foundation displays parsed flag evidence and source-document links; the PDF page overlay and disposition workflow belong to the later evidence feature.
- Tender navigation exposes Risk, Scope, Rates, and BOQ as tabs. Owner viewers see the signed-report access message without project navigation; the expiring share-link portal remains future work.

## 2026-09-28 — Document upload and analysis monitoring

- Add the two user-approved REST operations to the §6 endpoint list: re-process a failed document and retry one failed auditor in a terminal job. Both return existing Zod contract shapes; no data fields change.
- Use XHR for upload byte progress because browser `fetch` does not expose upload progress; send credentials and parse the completed response through the ProjectDocument schema. Keep all other requests on the typed fetch client.
- Poll queued document parsing and active jobs as a recovery path when a WebSocket update is missed. The shared project socket updates the TanStack Query cache and drives the header and Documents matrix; jobs started in the workspace remain monitored when navigating to the portfolio and back.
- The mock upload and analysis endpoints enforce a tenderer for priced BOQs and at least one parsed priced BOQ before analysis. Mock retries are limited to failed work and preserve the existing document and job IDs.

## 2026-10-02 — Production readiness audit

- Added `@axe-core/playwright` as a development-only dependency to check WCAG 2.1 AA issues on every implemented route in both locales and in the open Evidence Drawer.
- Remaining `[TODO zh-HK]` strings: **none**. Locale keys are in parity. Brand names, symbols, and non-translatable template tokens intentionally remain the same in both files.
- Use the existing Risk or Pre-Tender Scope route as the portfolio and project-switcher destination for the project's current stage, so the entry path opens functional data instead of the Project Overview placeholder.
- Move ECharts theme registration out of the global layout; dynamically load Evidence Drawer content, and retain client-only dynamic chart and PDF imports.
- Use the documented ECharts core build with only Bar, Line, Scatter, and the components these charts need. It reduced first-load raw JavaScript on Tender Risk and Scope by about 523 KiB each in a mock-enabled production build.
- Run `next build --webpack` through the existing `npm run build` script because the Turbopack/PostCSS build path cannot bind its internal process port in this environment. The Next.js framework and npm commands remain unchanged.
- Keep currently unimplemented Project Overview, Tender BOQ, Reports, Admin, and share-link owner routes explicit in the front-end setup guide. Report/share contracts require a separate product decision; no fields or endpoints are invented.

## 4 November 2026 — new-scope foundations

- The permission map and role fixtures already match AGENTS.md §4 after M1; tests now cover all roles and all current permissions. The mock role switcher remains an in-memory development preview. A full page reload resets it; client navigation preserves it.
- `globals.css` takes its core declarations from DESIGN.md §3. Supplemental Tailwind mappings expose the existing panel, muted-ink, surface and sidebar tokens used by components. Supporting sidebar-hover and chart-grid values come from DESIGN.md §§2 and 9. Brand and status values were preserved.
- Status vocabulary is centralized in `src/lib/config/status.ts`; UI labels live in both locales. Change/alignment low-confidence boundaries are 0.6/0.8, with a strict less-than comparison. Forecast confidence uses its categorical value.
- Percent change formatters accept fractions, consistently with the existing percent formatter: 0.042 → +4.2%. File sizes use decimal SI units (1 MB = 1,000,000 bytes). Ranges use an en dash with spaces and compact HKD by default; revision labels preserve issuer text.
- The user approved adding `react-dropzone`, the file-upload library prescribed by AGENTS.md §5. No other dependency was added for this task.
- Component provenance, DESIGN.md §12.4 checks and the §13 smell-test answers are recorded in `docs/foundation-adoption.md`. No new API contract or product module was introduced.

## 4 November 2026 — contracts and connected mock backend

- Approved endpoint envelopes were added to AGENTS.md §7 and `src/schemas/responses.ts`: `ProjectOverview`, `DrawingRegisterEntry`, and `SheetPreview`. Cursor lists preserve the array response plus `X-Next-Cursor` header. The existing entity fields are unchanged.
- The user approved the mock-only cost-range rule: retain the existing low/total/high proportions when pricing changes, or use VE-007's supplied proportions for a newly priced VE. The returned basis explicitly says “Synthetic demo range; QS review required.” This is not a production estimation method.
- `exceljs` is used only by the mock workbook parser/checker and sample generator; `pdf-lib` is a development dependency for generating samples. Scripts run with Node 22 TypeScript stripping, using the existing TypeScript installation for checks and no extra script-runner dependency.
- All generated files and fixture metadata are reproducible. Workbook ZIP timestamps are normalized as well as workbook metadata; drawing bboxes use normalized coordinates measured from the top-left of each page. File hashes are SHA-256 hashes of actual downloadable bytes, not synthetic identifiers.
- Initial fixtures represent a populated review snapshot: A-201 Rev C and BOQ v2 are already current, with VE-007 present. Re-uploading identical files deliberately produces duplicate conflicts. The uploaded bytes and all mutations are held in memory for the mock session; a full browser reload resets the fixture snapshot. Background timers continue across client navigation and sockets replay current progress after reconnect.
- New drawing revisions automatically queue comparison when they supersede an existing current revision without a conflict, following the connected story in AGENTS.md §2. Deterministic detected regions are supplied only for known A-201 B → C and S-110 P1 → P2 file hashes. Arbitrary uploads are stored, but unsupported comparison pairs fail with an explicit explanation rather than inventing a zero-change result; the mock does not perform change detection.
- The sample workbook uses a BOQ sheet and mapping A–F for the six required fields, G for section, and optional mock metadata H for material. Rule checks use real parsed values and cached Excel formula results; ExcelJS is not an Excel formula calculation engine. Original file bytes remain unchanged; annotated downloads add cell notes and fills to a copy. Diff alignment uses sheet + physical row, appropriate to the supplied append-only v2 sample; more advanced inserted-row matching is a later workbook slice.
- Procurement scans eligible forecast months through the latest order date, chooses the cheapest p50, and extends the window over adjacent tied months. Quantities multiply the chosen p10/p90 bounds. Rebar's equal February/March medians produce the required Feb–Mar 2027 window. Synthetic advice defaults to medium confidence with forecast coverage, low when there is no eligible forecast; it does not infer a production confidence threshold from backtest error.
- Documents now renders the new hub records read-only; the upload/version/conflict workflow UI remains the Document hub task. Audit keeps its existing pagination/filter/export UI and now includes event summaries in CSV. Both pages consume Zod-validated API data.
