# AegisQS front end

## Run locally

Use Node.js with npm. Install the locked dependencies with `npm ci`. Add `.env.local` containing `NEXT_PUBLIC_API_MOCKING=enabled`, then run `npm run dev` and open `/en/projects`. The equivalent Traditional Chinese route starts with `/zh-HK`. The demo project is `P-001`; its working tender overview is `/en/projects/P-001/tender/risk`.

The mock worker intercepts `/api/v1` HTTP requests and project WebSocket traffic in the browser. Its deterministic fixtures include 12 tenderers, a 3,000-row rate grid, flags, a sample PDF, and simulated analysis progress. The mock role switcher appears in the header only when mocking is enabled. Choose `senior_qs`, `junior_qs`, `owner_viewer`, or `admin` to inspect permission-dependent views; the switcher changes mock responses, not authentication or backend permissions. The owner role sees only signed content. Mock state resets when the browser mock worker restarts.

To exercise the large grid fixture, start the dev server with `NEXT_PUBLIC_MOCK_GRID_ROWS=5000` as well as mock mode, then visit `/en/projects/P-001/tender/rates`. The grid loads cursor pages and virtualizes rows.

## Use a real backend

Set `NEXT_PUBLIC_API_MOCKING=disabled` and rebuild/restart Next.js. Serve the backend API at the **same origin** under `/api/v1` and the project socket at `/ws?projectId=…` (for example, through a reverse proxy). The typed client sends cookies with each request; the backend must set and validate the httpOnly authentication cookie and enforce permissions. No browser token storage is used. Every JSON response is checked against its Zod schema, so incompatible API responses surface as validation errors. The WebSocket client parses events and writes them into the TanStack Query cache. In real-API mode the role switcher disappears.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e` are the main checks. Playwright starts a mock-enabled server and scans each available route in both locales with axe, including an open Evidence Drawer. `npm run build` performs a production Webpack build. The build script uses Webpack because Turbopack's PostCSS loader attempts to bind a blocked port in this environment. Next's font build needs network access to fetch Karla and Noto Sans HK.

## Performance snapshot (2026-10-02)

The figures below are total uncompressed JavaScript response bodies fetched during the first load of each **English** route in a fresh Chromium context, using a mock-enabled production Webpack build. They include shared Next.js, app, and MSW code, and are useful for comparing routes, not as compressed transfer sizes. The `zh-HK` routes use the same code chunks.

| Route                                      | Raw JavaScript (KiB) |
| ------------------------------------------ | -------------------: |
| `/en`                                      |                1,077 |
| `/en/login`                                |                1,331 |
| `/en/projects`                             |                1,189 |
| `/en/admin`                                |                1,190 |
| `/en/projects/P-001/overview`              |                1,190 |
| `/en/projects/P-001/documents`             |                1,206 |
| `/en/projects/P-001/pre-tender/scope-gaps` |                2,538 |
| `/en/projects/P-001/tender/risk`           |                1,857 |
| `/en/projects/P-001/tender/scope`          |                2,540 |
| `/en/projects/P-001/tender/rates`          |                1,266 |
| `/en/projects/P-001/tender/boq`            |                1,191 |
| `/en/projects/P-001/flags`                 |                1,209 |
| `/en/projects/P-001/reports`               |                1,190 |
| `/en/projects/P-001/audit`                 |                1,202 |
| `/en/projects/P-001/flags?evidence=F-001`  |                1,904 |

The Risk and Scope charts use client-only dynamic imports and ECharts core modules. The PDF viewer loads when evidence opens: the flag inbox loads 1,209 KiB, while the same route with PDF evidence open loads 1,904 KiB. No chart canvas or browser console error appeared on non-chart routes during this check. The 5,000-row fixture was exercised separately: all 50 cursor pages loaded, the final row was visible, and fewer than 80 body rows remained mounted at a time.

## Current boundaries

The portfolio, Documents, Tender Risk, Scope, Rates, Flags, and Audit pages use the mock contracts and support their available loading, empty, and error states. Project Overview, Tender BOQ, Reports, and Admin are explicitly labelled placeholders. The share-link owner route is not yet implemented. Reports and sharing need a contract decision for provenance/disclaimer, editable auditor notes, and share-link operations before those pages can be completed. The mock login screen is a navigation entry point; real login is the backend's responsibility.

The page-state audit found:

| Route | Loading, empty, error, and insufficient-data handling |
|---|---|
| Home, login | Static pages; no data request. |
| Projects | Skeleton, no-project message, retryable error; App Shell handles session loading/error. |
| Documents | Skeletons, upload guidance when empty, retryable document/job errors, per-auditor failed state. |
| Tender Risk | Skeletons, no-completed-job/no-bids messages, retryable error, insufficient benchmark signal state. |
| Pre-Tender Scope, Tender Scope | Skeletons, missing inspection-report/no-findings messages, retryable error, insufficient bid-data state. |
| Tender Rates | Skeleton, empty/filter-empty messages, retryable error, insufficient benchmark rows. |
| Flags | Skeleton, empty/filter-empty messages, retryable error; missing evidence is shown as an error. |
| Audit | Skeleton, empty/filter-empty messages, retryable initial or later-page errors. |
| Project Overview, Tender BOQ, Reports, Admin | Specific unavailable message with a link to a working review route. |

The unavailable routes are not complete product screens; they are tracked here so a successful accessibility scan is not mistaken for feature completion.
