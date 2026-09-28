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
