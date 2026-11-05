# Supabase migration and operation

## Status and reuse

The configured hosted project was migrated and seeded on 5 November 2026. Real cookie sign-in, all module reads, persistent upload/private download and anonymous denial passed live acceptance. One labelled verification site record is retained. The setup steps below are for a new environment; do not rerun the one-time migration against the already migrated project.

The existing feature UIs now have a real `/api/v1` backend. It reuses the same request-scoped domain handlers as MSW, the canonical `can()` policy, Zod schemas, workbook parser/checks/diff, indicative-cost rule and procurement calculation. No new dependencies were installed. Mock mode remains available for the original browser tests and demo. Do not disable it until the steps below finish.

The server key belongs only in the ignored root `.env.local`. Never put it in a `NEXT_PUBLIC_` variable or the add-in. Rotate a key that was shared in chat, then update `.env.local`.

## 1. Create the tables

Open Supabase → SQL editor → New query. Paste and run **the entire** [migration](../supabase/migrations/202611050001_smart_qs.sql). It is transactional and creates the tables, private bucket, indexes, RLS and server-only transaction functions. It is a one-time migration, not a reset script. Do not run it against an existing application schema without reviewing table conflicts.

Alternatively, add an authorised PostgreSQL `DATABASE_URL` to `.env.local` and run:

```bash
npm run db:migrate
```

This needs `psql`. The script uses certificate validation for remote databases; configure `PGSSLROOTCERT` (or `sslrootcert` in the URL) if your database requires its supplied CA certificate. A publishable or secret API key cannot execute SQL DDL. They do not replace a PostgreSQL connection or the SQL editor.

Tables: `user_profiles`, `projects`, `documents`, `document_versions`, `version_conflicts`, `drawing_comparisons`, `drawing_changes`, `variation_events`, `workbooks`, `workbook_versions`, `workbook_checks`, `boq_items`, `materials`, `price_forecasts`, `procurement_advice`, `material_needs`, `entity_links`, `audit_events`, `parsed_workbooks`, `file_objects`, `project_events`, `backend_revision`.

Each entity has its own table and a Zod-validated JSONB payload matching the existing camelCase contract. IDs, project scope and selected foreign keys are SQL columns; indexes support membership, versions and checks. This is an MVP persistence design, not a single shared application-state blob. Costs, forecasts and workbook sheet data retain their existing nested contract structures.

## 2. Seed every module and private sample file

Set these in root `.env.local` (replace placeholders; do not commit this file):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_KEY
SMART_QS_BOOTSTRAP_EMAIL=your-email@example.com
SMART_QS_BOOTSTRAP_PASSWORD=choose-a-long-unique-password
NEXT_PUBLIC_API_MOCKING=enabled
SMART_QS_DEMO_PROCESSING=enabled
# Optional real Hugging Face drawing-difference worker (FastAPI backend):
AEGISQS_BIM_WORKER_URL=http://localhost:8000
```

The legacy server-only `SUPABASE_SERVICE_ROLE_KEY` is also accepted. The bootstrap email/password are the first Smart QS Senior QS login you choose for this project. Supabase enforces the password policy configured for your project. Choose a long, unique password. The seed creates the bootstrap Auth account if missing, or links the existing account without changing its password. It grants the explicitly configured bootstrap account the seeded Senior QS profile (`user-0`) on P-001. It does not grant roles from public signup or user-editable Auth metadata.

Use Node.js 22.15+:

```bash
npm ci
npm run db:seed
```

This migrates all deterministic fixture records and sample files: 40 documents, five drawing revisions, versions/conflicts, comparisons/changes, six variations, both workbook versions and 1,203 parsed items, checks, forecasts for ten materials, procurement, links and audit history. PDFs and XLSX bytes go to **private** `smart-qs-files` Storage objects; the database stores their references. All fixtures and forecasts are synthetic demo data.

The seed refuses to overwrite a database containing project records. Project records commit atomically. Auth accounts/profiles and Storage uploads are separate services; a failed seed can leave these prerequisites but can be retried while project tables are empty. It never changes an existing account password.

## 3. Run with persistence

Change root `.env.local` to:

```env
NEXT_PUBLIC_API_MOCKING=disabled
```

Restart the development server and run the worker in another terminal. If a previous mock-mode server is already running, stop it with Ctrl+C first:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run db:worker
```

Open `/en/login` (or `/zh-HK/login`) on the printed port. Sign in with your bootstrap email/password. Documents, drawings, variations, workbook checks/mapping/diff, materials/procurement, overview and audit use PostgreSQL. Refreshing or restarting Next no longer resets data. Sign out is in the header. The mock role switcher/reset controls are absent. To add other roles, provision an Auth account and map its Auth UUID to a server-managed `user_profiles` record whose ID is included in the project's `memberIds` array. No automatic administrator-on-first-login rule exists.

The sample database is the finished snapshot: A-201 C and BOQ v2 are already current. Re-uploading identical files intentionally creates a conflict. No development reset deletes hosted data.

## Auth, security and transactions

The frontend still calls the existing API and parses responses with Zod. Supabase auth is server-side only, with httpOnly cookies, authenticated `getUser()` checks, same-origin mutation checks, project membership and `can()` permission enforcement. Responses that carry auth cookies are private/no-store. No secret/token is placed in browser storage.

RLS allows authenticated members to read their projects and signed-in users to read the materials catalogue. Anonymous users have no application-data access. Ordinary accounts cannot write tables or change their profile role directly. Server-only RPC commits use the secret key after API checks. Audit records are append-only through the commit function. Versions are retained; replaced derived checks/items/links are archived with `active=false`.

All entity changes, links, audit entries and events from an action commit together, under a revision lock/CAS. A concurrent mutation returns 409 with reload/retry direction rather than silently overwriting another action. A unique index and commit validation preserve one Current document version. File objects have immutable keys; if a DB commit fails, an unreferenced private object can remain for later administrative cleanup, but an existing file is never overwritten.

## Jobs and events

The separate worker recovers pending comparisons and workbook checking stages from persisted status/timestamps; restarting the worker does not lose the job. Workbook parsing uses real uploaded Excel bytes on the server. The worker completes the persisted checks and emits durable events. For large deployments, parsing should move from the upload request to a dedicated queued parser and the database-wide revision lock should become per-project transactions.

**Drawing detection can use a real Hugging Face worker.** When
`AEGISQS_BIM_WORKER_URL` is set, the durable worker downloads the two stored
revision files and POSTs them to that FastAPI worker's
`/api/v1/bim/revision-comparisons` endpoint. CLIP/material inference is run
there and the returned change cards are persisted into Supabase. Without the
worker URL, `SMART_QS_DEMO_PROCESSING=enabled` permits the synthetic A-201
B→C and S-110 P1→P2 detections; with the setting off, pending comparisons
fail with a clear unconfigured-service message.

**Transport adjustment:** in database mode, `/ws?projectId=…` is a cookie-authenticated **Server-Sent Events** stream, because standard Next Route Handlers cannot host WebSocket upgrades. The `WsEvent` payload contract is unchanged, and `useProjectEvents` remains the only subscriber/cache writer. Events have a database sequence cursor for reconnect, the connection reauthenticates when reopened, and a 50-second stream lifetime bounds stale access. Mock mode retains the original MSW WebSocket. Deploy behind a proxy that allows streaming and run a persistent worker process. Reconnect refreshes query data, so initial views show completed jobs even when their events occurred while offline.

## Excel task pane

In `addin/.env.local` set `ADDIN_API_MOCKING=disabled` and `SMART_QS_API_ORIGIN` to the main app origin. No Supabase server key is needed there. The built-in `/login` page signs in through the backend and retains httpOnly cookies on the add-in origin; the existing Office dialog nonce checks are retained. The API proxy validates its own same-origin mutations, forwards cookies and preserves refresh cookies. Use HTTPS for the add-in; Office host/browser cookie restrictions may require its existing Allow cookie access action. Save/check/pull all use the same persistent workbook API. Excel web still uses the approved download-and-upload fallback. Actual Microsoft 365 sideload acceptance remains manual.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The normal Playwright configuration starts its own **mock-mode** server. `tests/database-backend.test.ts` exercises the actual route dispatcher with an isolated repository double: authenticated feature reads, permissions/CSRF, decision/audit commit, rollback, private upload/download and real XLSX processing. `supabase/tests/security.sql` is for an isolated PostgreSQL database with the fixture seed and test Auth UUID, never production. The migration and fixture seed were also exercised in an isolated local PostgreSQL cluster.

Live acceptance after deployment: upload a uniquely named document, reload and download it; resolve CON-004 as Senior QS; edit a VE cost line, reload and verify audit; create advice; upload a workbook, leave/reopen it after the worker finishes, inspect checks and diff. Verify separate QS and Viewer accounts cannot make senior decisions. Unit tests and mock E2E do not substitute for this hosted acceptance run.

Official references: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Storage access](https://supabase.com/docs/guides/storage/security/access-control).

Live verification can be repeated with `node --env-file=.env.local --import ./scripts/register-typescript.mjs scripts/verify-supabase.ts` against a real server on port 3300 (or set `SMART_QS_VERIFY_ORIGIN`). Each run creates one labelled site record and audit event; it never deletes records.
