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

## 4 November 2026 — document hub, drawing review and variation costing

- Migrated the existing Documents screen in place. Reused the credentialed upload helper, Dropzone, status vocabulary, DecisionForm, shared VirtualTable, PDF renderer/bbox maths, DetailDrawer, API resources/query keys, session/can(), WebSocket cache pattern, SummaryCard and audit timeline. Replaced the Drawings and Variations route placeholders. No feature module was duplicated or deleted in this slice.
- Added only prescribed stack dependencies: `react-zoom-pan-pinch` for synchronized transforms, `react-hook-form` and `@hookform/resolvers` for metadata validation. No wire contract changed. Existing document numbers route through the version-upload endpoint, including case-insensitive matches shown by the form.
- The user explicitly specified a new range rule for this slice, superseding the earlier mock proportional-range decision: low = total × 0.92, high = total × 1.09; basis “Contract BOQ rates; quantities entered by QS”. It lives in `src/lib/config/variation.ts` and is used by both the live editor and mock response. Endpoints are sorted for negative omission totals. The untouched VE-007 fixture preserves the original §12 range; newly saved HK$186,400 costs return HK$171,488–203,176.
- Document register revision/uploader fields are derived from existing version endpoints because HubDocument has neither field. TanStack Query deduplicates those requests; no response fields were added. The UI identifies the single current version from `currentVersionId`, including while conflicts await a senior QS reasoned resolution.
- Source traceability reuses EntityLink: document/version drawers, change-to-comparison links, BOQ row and workbook-version read-only views/downloads, and a material forecast table with ranges/model provenance. Full workbook/material/procurement workspaces remain later slices.
- The viewer keeps React-PDF canvas rendering, uses one synchronized transform, applies target alignment in the canvas compositor, and adds SVG revision clouds. Zoom-settled PDF re-renders are debounced 150 ms; pan/swipe use existing canvas pixels. The change list is the text alternative. The supplied A1 sheets are the visual QA source; arbitrary change detection remains a backend concern.
- The 21st catalog search required unavailable authentication; existing project primitives were reused. The 21st CLI review of the changed feature/viewer/record folders reported 0 findings. No external registry code was copied. DESIGN.md §12.4 checks retain tokens, Karla/Noto Sans HK, sentence case, visible keyboard focus, status labels, translated copy, border-only panels and no decorative effects. DESIGN.md §13 smell test: all ten answers are **No**; costs and forecasts include ranges, clouds mark changes only, and blue is reserved for target revision semantics.
- All new interface keys have Traditional Chinese translations; no new `[TODO zh-HK]` placeholders. The setup guide documents routes, the populated snapshot, a fresh comparison path, uploads, roles, range behavior and remaining placeholders.

## 5 November 2026 — Excel upload and checks

- Reused the existing workbook schemas/resources, credentialed upload helper, Dropzone, Dialog/Tabs, DecisionForm, StatusChip, VirtualTable, grid navigation and sole `useProjectEvents` subscriber. Replaced the workbook register placeholder and added its detail route. No feature folder was deleted or duplicated; no dependency or wire-contract change was needed.
- The retained grid foundation had virtualization and arrow navigation, but no retained spreadsheet renderer/frozen-column UI. `components/grid/sheet-grid.tsx` composes TanStack Virtual and `moveGridCell`, freezes the row-number column, draws semantic issue markers, and keeps every cell read-only. Sheet windows are fetched until the last partial window; item cursors are followed through the final page, with both views virtualizing DOM rows.
- Workbook history is resolved through hub document versions and existing EntityLinks. Version/history queries share the workbook key prefix, so completion events refresh them. The socket contract emits completion only; polling recovers parsing/checking transitions without inventing progress percentages or socket events.
- New uploads open the mapping wizard. Required fields must map to distinct columns, suggestions come from sheet headers, and saving reruns existing mock parsing/checks. Mock completion now uses the latest mapped parse and replaces checks for that version, avoiding duplicate checks if mapping is saved before the five-second job finishes.
- New UI strings are translated in both locales. The 21st catalog search was unavailable without authentication, so existing project primitives were reused. Adoption checks retain theme tokens, Karla/tabular figures, sentence case, named keyboard controls and no decorative effects. All ten DESIGN.md §13 smell-test answers are No. Full workbook diff remains Task 07; Excel remains the editor.

- First uploads provisionally parse the BOQ sheet or, if absent, the first sheet with A–F defaults, so cost-plan/valuation files can reach the mapping wizard. An explicitly saved mapping is still enforced. No response shape changed.

- Completion toasts exposed a shared Radix Escape-layer conflict. The URL drawer now handles Escape at capture when it is the top open dialog, preserving nested-dialog priority and its existing focus restoration.

## 5 November 2026 — workbook version differences

- Extended the existing workbook workspace with Diff. Reused `useVersions`, the typed `/diff` resource/query key, VirtualTable, SummaryCard, StatusChip, formatting and the client-only ECharts core wrapper/theme. No feature folder was deleted, no dependency was added and no wire contract changed. The existing mock endpoint now calls the corrected diff matcher instead of a new parallel implementation.
- Replaced physical-row identity with sheet + item reference. Rows moving within a sheet no longer become changes. Duplicate occurrences are paired separately; where the seeded duplicate-reference check corrupts an otherwise identical source row, a same-row/description reconciliation records the reference correction instead of inventing a new VE line. Tests cover moves, additions, removals, field edits, duplicates, cross-sheet identity and the real fixture.
- Section is absent from WorkbookDiff, so filters use the existing base/target item endpoints. VE chips match existing cost-line references or the seeded appended description including the VE reference. No inferred link is persisted. Null/formula-error amounts preserve the existing zero treatment, explicitly disclosed next to the totals. The fixture total is +HK$123,014.55; the 3 VE additions total HK$186,400 and exactly 2 existing rates change.
- Extracted the audit CSV serializer into `lib/export/csv.ts` and reused it from both features, preserving BOM, quoting and CRLF. Diff CSV headers are localized and filters apply to the export. Signed currency formatting is shared through `lib/format`.
- Historical version metadata now populates the existing individual query keys, avoiding duplicate requests and tab remounts when a chart point selects a version. The step chart loads client-side in a fixed-height container and has clickable table controls as its keyboard/text equivalent.
- 21st catalog retrieval required authentication; existing project primitives were reused. The CLI UI review reported zero findings. Adoption checks retain theme tokens, semantic icon/text chips, Karla/tabular figures, sentence case, visible focus and no decorative effects. All ten DESIGN.md §13 answers are No; displayed amounts here are actual workbook totals/deltas, not forecasts or indicative estimates.

## 5 November 2026 — materials catalogue and forecasts

- Reused material schemas/API/query keys, the shared ECharts wrapper/theme, status chips, formatters, LowConfidenceNote, AiGeneratedLabel, SegmentedControl and dialog/state primitives. Replaced the Materials placeholder and moved its existing record-drawer forecast table into the materials feature; the full page and compatibility drawer share components. No deleted price-distribution code was revived, no feature folder was deleted, and no dependency or wire-contract change was needed.
- Fan bands use separate stacks: p025 + (p975 − p025), and p10 + (p90 − p10). Hidden baselines have transparent areas/lines; visible spans use the prescribed limewash tokens. The median continues from the last observed price. Tooltips pair every forecast median with both ranges. The latest-observation line is labelled with its source period, not the browser date.
- Horizon changes chart/table visibility only. Glance cards look up exactly three/six calendar months after `Material.latestPeriod`; missing forecast months show an unavailable state. `change3mPct` and `backtestMapePct` are percentage points in the contracts, so they are divided by 100 before using fraction-based formatters.
- The user’s low-confidence rule is strict backtest MAPE > 10%, centralized in `lib/config/forecast.ts`. This is a derived presentation state; it does not add a forecast confidence field or change procurement confidence. Backtest MAPE is labelled as a mean absolute error, not a confidence interval.
- Charts load client-side only inside fixed-height containers. The full historical/forecast table is collapsible; compatibility drawers show it expanded and scroll their own content. Material sparklines show observed history only. Planning remains an explicit, permission-gated Task 09 stub with no save action.
- The 21st catalogue required authentication, so existing project primitives were reused. Adoption checks preserve tokens, Karla/tabular figures, sentence case, keyboard controls, semantic icon/text status and translated copy, without decorative effects. All ten DESIGN.md §13 smell-test answers are No; forecast medians always have adjacent ranges and model basis.

## 5 November 2026 — procurement planning

- Reused SummaryCard, StatusChip, LowConfidenceNote, dialogs, state components, the ECharts core wrapper/theme and existing fan chart, procurement schemas/resources/query keys, mock advice calculation and linked-record navigation. Replaced the procurement ComingPage and material planner stub. No dependencies, wire contracts or unrelated features were changed.
- Extracted the existing latest-order-date arithmetic to `lib/procurement/latest-order-date.ts`, shared by the planner and mock calculator. Dates are normalised to UTC and lead weeks are seven calendar days. Needs prefill quantity/date; the latest saved advice supplies lead time when present. Without it, lead time remains required and blank. A non-positive net material need cannot start a purchase.
- Advice keeps every expected value adjacent to its p10–p90 range, including a saving range calculated as current cost minus the high/low forecast costs. Low confidence precedes the recommendation in the detailed card and saved list. Rationale is labelled AI-generated; model/version, trained-through period and backtest error are shown from the existing forecast response, not invented advice fields.
- Exposure sums each need's supplied p10/p50/p90 by material and sorts by p90. This is an illustrative aggregation of marginal ranges, not a model of cross-material correlation; the chart caption identifies the basis. Horizontal mark lines carry p10–p90 whiskers over grey p50 bars, with a table alternative.
- Forecast overlays reuse the existing fan-chart builder: lichen at 35% for full window months, dashed caution for latest order and solid ink for need-by. Daily lines are positioned within their monthly category, with exact dates in labels and the advice card. A notice explains dates outside the selected horizon. Project/advice query parameters support links from saved advice; mock records last for the current mock session.
- Existing project primitives were reused after the 21st catalogue required authentication. The CLI review reported zero findings. Theme tokens, Karla/tabular numbers, sentence case, focus restoration, semantic status text/icons and both locales are retained. All ten DESIGN.md §13 smell-test answers are No.

- Fast role changes exposed a race in the existing ECharts React adapter: an update could trigger the temporary initialization instance's `finished` handler and dispose it during `setOption`. The shared wrapper now defers updates until `onChartReady`; the adapter applies the latest props during initialization. Procurement E2E also checks browser warnings and errors, preserving updates after readiness.

## 5 November 2026 — project overview and connected audit

- Reused SummaryCard, AuditTimeline, useAuditEvents, cursor collection/filter/CSV helpers, EntityActivity, record links and the typed resources. Replaced only the overview ComingPage; completed existing timeline navigation and added activity to comparison/workbook views. No dependencies or wire contracts changed.
- Overview reads existing endpoints instead of extending ProjectOverview: comparison IDs come from the drawing register and audit history, then full comparison/change records are fetched. Counts use the current Hong Kong calendar month; checks use current BOQ versions only. Potential and confirmed indicative amounts retain ranges, with the priced-record count and cost-line basis visible. Unpriced events are not silently treated as priced zero estimates.
- Recent activity shows up to fifteen events; the overview response mock now also returns fifteen. Audit events are scoped through their referenced project entities in the mock, since AuditEvent deliberately has no projectId field. The original timeline filters, pagination and CSV export are preserved. Procurement audit links select saved advice; document-version, check and change links reuse the global drawer; comparison and variation links open their routes.
- Comparison activity combines its own events and change reviews. Workbook activity combines workbook, selected version and check events. Existing document and variation activity components remain shared. No audit mutation controls were introduced.
- The 21st catalogue required authentication, so existing primitives were reused. Theme tokens, tabular numbers, sentence case and visible focus remain intact. DESIGN.md §13: all ten smell-test answers are No.
