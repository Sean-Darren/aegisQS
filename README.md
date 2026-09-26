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

The folder skeleton follows AGENTS.md §7. Empty route folders are reserved for future work and are not live pages. The only mock endpoint is `/api/v1/me`; full product fixtures, WebSocket simulation, and UI primitives belong to later feature slices.
