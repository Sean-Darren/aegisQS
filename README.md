# Smart QS (AegisQS)

Front-end scaffold for the Smart QS independent cost-audit platform.

## Setup

Use Node.js 22.13+ (Node.js 24 recommended) and npm.

```sh
npm ci
cp .env.example .env.local
npx playwright install chromium
npm run dev
```

Open http://localhost:3000/en or http://localhost:3000/zh-HK. `/` redirects to `/en`.
Set `NEXT_PUBLIC_API_MOCKING=enabled` to start browser MSW. Omit the flag or set it to `disabled` to use real requests. Restart the development server after changing it.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Vitest enables Node MSW with strict unhandled-request checking. Playwright starts a dedicated development server on port 3100 with browser mocks enabled and tests both locales. Google fonts are downloaded by Next.js at build time.

The folder skeleton follows AGENTS.md §7. Empty route folders are reserved for future work and are not live pages. All REST endpoints in AGENTS.md §6 and `/ws?projectId=...` are mocked. Product UI remains out of scope.

## Mock backend

- `src/schemas/index.ts` exports every §6 Zod schema and inferred type.
- `src/lib/api` exports `apiClient`, `resources`, `createApiClient`, `createResources`, `ApiError`, and `queryKeys`. JSON responses are parsed with Zod; file downloads return a validated Blob. Requests always include cookie credentials.
- `src/mocks/fixtures/data.ts` produces the same seeded data on every reset: 12 tenderers, 3,000 rows, 150 flags, and the specified bid/score/benchmark values.
- Mocks live in memory. Reloading the browser or calling `resetMockState()` resets mutations, uploaded files, timers, and the active role. Node tests reset automatically.
- `setMockRole(role)` in `src/mocks/store.ts` selects the simulated user for tests or future dev tooling. It is not an authentication mechanism. No role-switcher UI is included.
- POST an analysis job, then subscribe to project events. Jobs run for 20 seconds, even with no socket subscribers. There is one active job per project, with 48 progress entries and three new evidence-backed flags. Reconnecting clients receive current progress.
- Mount `useProjectEvents(projectId)` below a TanStack `QueryClientProvider`. It owns the socket lifecycle, updates matching cached flag lists and job progress, and invalidates results at completion. Use the supplied query-key factory consistently.
- Rate-grid pages contain up to 100 rows. Audit responses remain arrays; `X-Next-Cursor` carries the next page token. `resources.auditEvents()` exposes `{data, nextCursor}` locally. Pass opaque cursors back unchanged with the same filters.
- Uploads retain their bytes and progress from queued to parsed after one second. The mock does not actually parse documents. Report sign-off enforces final decisions and produces a signed metadata record; certificate PDF generation is a later feature (`pdfUrl` remains optional).
- Percent formatters accept fractions (`0.15` → `15.0%`); dates use Asia/Hong_Kong. Insufficient-data booleans remain explicit in fixtures and are not formatted as zero.

### Sample evidence PDF

`public/mock-docs/sample-priced-boq.pdf` contains 150 cited excerpts across ten pages. All seeded document IDs serve this fictional sample; uploaded document IDs serve their actual uploaded bytes. Each flagged row's cited rate matches its grid rate.

`scripts/generate-mock-pdf.py` regenerates the PDF, normalized top-left bounding boxes, and the identical byte payload used by MSW. It uses ReportLab and pdfplumber from the bundled Codex Python runtime, not application dependencies. Generation verifies that every box contains its exact excerpt. The pages have also been rendered and visually checked.
