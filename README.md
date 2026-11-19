# Smart QS (AegisQS)

Smart QS is a hackathon prototype for Quantity Surveyors working on Hong Kong building projects. It connects drawing revision reviews, potential variations, BOQ workbook checks and material procurement planning in one workspace.

The hackathon has ended, and the hosted EC2 demo is being retired. Run the project locally using the mock mode below; no hosted account or cloud credentials are needed.

## What you can explore

| Module                    | Workflow                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Document hub              | Upload documents, retain revision history, identify conflicts and keep one current version.                        |
| Drawing revisions         | Compare supplied drawing revisions, inspect revision clouds and review suggested changes.                          |
| Potential variations      | Link reviewed changes to BOQ items and enter quantity changes to calculate an indicative cost with a range.        |
| Excel integration         | Upload real workbooks, map columns, review checks, compare versions and download copies. Excel remains the editor. |
| Materials and procurement | Explore material price history, forecast bands, project exposure and suggested procurement windows.                |
| Audit trail               | Follow uploads, reviews, cost updates and other project actions through linked records.                            |

The interface supports English (`en`) and Traditional Chinese (`zh-HK`). QS, Senior QS and Viewer roles have different permissions. Suggestions, cost ranges and forecasts require professional review; the mock forecasts and prices are synthetic demonstration data.

## Run locally

Use **Node.js 22.18 or newer** and **npm**. Install from the repository root; the Excel add-in is an npm workspace sharing the root lockfile. The committed `.npmrc` contains the dependency-resolution setting used by that lockfile.

```sh
npm ci
```

Create `.env.local` with the following settings. If it already exists, update these entries without overwriting your other configuration:

```dotenv
NEXT_PUBLIC_API_MOCKING=enabled
AEGISQS_HF_LOCAL_FALLBACK=disabled
```

Then start the application:

```sh
npm run dev
```

Open the local port printed by Next.js (normally port `3000`) and navigate to `/en/projects` or `/zh-HK/projects`. Open **P-001 — Central Market Rehab Phase 2**. Mock mode starts as Senior QS and exposes a development role selector in the header. It does not require a real sign-in.

The sample PDFs and workbooks are already committed under `public/mock-files/`. To regenerate them and their fixture metadata:

```sh
npm run mock:files
```

Restart Next.js after changing environment settings. Mock state lives in browser memory: client navigation preserves changes and background jobs, while a full reload restores the seeded snapshot.

## Try the connected demo

Choose **Start demo story** in the development header to prepare the starting position, then:

1. In **Documents**, upload `public/mock-files/drawings/A-201-rev-C.pdf` as drawing **A-201**, revision **C**. It supersedes Rev B and starts a comparison.
2. Inspect the four suggested changes in **Drawings**, using the comparison viewer and change list.
3. Review the slab opening and new beam changes, then raise a potential variation.
4. Link BOQ items **3.2.14**, **2.1.08** and **2.4.03**, with quantity changes **4.2**, **20** and **100**. The contract rates give **HK$186,400**, with an indicative demo range of **HK$171,488 – HK$203,176** after saving.
5. In **Procurement**, inspect the additional **4.2 tonnes of rebar** and request advice using the sample need-by date and lead time. The synthetic example recommends **Feb–Mar 2027**, with expected savings and a risk range.
6. Upload `public/mock-files/workbooks/boq-v2.xlsx` as a new Contract BOQ version. Review the amount mismatch and other checks, then inspect the version diff.
7. Open **Audit** to follow the recorded actions and their source records.

The default snapshot already contains Rev C, VE-007 and BOQ v2. Re-uploading identical files there intentionally creates conflicts; use **Start demo story** first. **Reset demo data** restores the finished snapshot. Both controls are development-only mock controls.

See [the demo walkthrough](docs/DEMO.md) and [the detailed frontend guide](docs/README-frontend.md) for more interactions, keyboard shortcuts and calculation assumptions.

## How the modes differ

| Mode                     | Requirements                                                         | Behaviour                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local mock demo          | Node.js, npm and the two settings above                              | MSW serves fixture-backed API responses and simulated background jobs. Real Excel files are parsed; drawing change detection uses supplied known revision pairs. |
| Persistent backend       | Your own Supabase environment, schema, credentials and worker        | Next.js API routes use server-side authentication, private file storage and persisted project data.                                                              |
| Optional Python analysis | Python dependencies, model resources and worker/bridge configuration | Experimental analysis integrations under `backend/`; unnecessary for the fixture demo.                                                                           |

**Persistent setup is currently incomplete in this checkout:** [the Supabase guide](docs/SUPABASE.md) and `npm run db:migrate` reference `supabase/migrations/202611050001_smart_qs.sql`, which is absent from the repository. Recover and review the schema before attempting a fresh persistent installation. The database commands are for an explicitly configured environment; they are not part of the local quick start.

Optional Python bridges default to a machine-specific Python path. Configure `PYTHON_BIN` explicitly if you explore them. Keep worker services on a trusted private interface; the current worker accepts an allowed `Origin` header as well as bearer credentials, so its origin allowlist is insufficient protection for an Internet-facing service.

The prototype is preserved for demonstration and development. Administration is an informational screen, real Microsoft 365 sideload acceptance remains manual, and forecasts are not a live market feed.

## Optional Excel task pane

Create `addin/.env.local` containing:

```dotenv
ADDIN_API_MOCKING=enabled
```

Then, from the repository root:

```sh
npm run dev --workspace smart-qs-excel-addin
```

The add-in uses local HTTPS on port `3200`. Follow [the add-in guide](addin/README.md) to trust the development certificate and sideload `addin/manifest.xml`. Its mock backend is a separate server process from the main app's browser mock session. It reviews and uploads workbook copies without editing Excel cells.

## Commands and checks

| Command                                              | Purpose                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                        | Start the web development server.                           |
| `npm run typecheck`                                  | Check root TypeScript types.                                |
| `npm run lint`                                       | Run ESLint.                                                 |
| `npm test`                                           | Run Vitest tests.                                           |
| `npm run build`                                      | Build the main Next.js application.                         |
| `npm run test:e2e`                                   | Run the Playwright browser suite with its own mock server.  |
| `npm run mock:files`                                 | Regenerate sample drawings, workbooks and fixture metadata. |
| `npm run typecheck --workspace smart-qs-excel-addin` | Check add-in TypeScript types.                              |
| `npm run build --workspace smart-qs-excel-addin`     | Build the Excel task pane.                                  |

Install Playwright Chromium before browser tests with `npx playwright install chromium`. Browser tests require their configured ports to be free. Some existing image/Hugging Face integration tests refer to developer-local files absent from this checkout and require separate setup; the full suite is not a portable clean-clone check yet. Run typecheck after the Playwright server stops because Next.js regenerates included route types.

## Repository map

```text
src/app/             Next.js routes and API handlers
src/features/        Feature components, hooks and API clients
src/components/      Shared UI, charts, grids and drawing viewers
src/lib/             Permissions, formatting, domain logic and backend adapters
src/schemas/         Zod data contracts
src/mocks/           MSW handlers and deterministic fixtures
src/messages/        English and Traditional Chinese UI copy
public/mock-files/   Generated demonstration PDFs and Excel workbooks
addin/               Office.js Excel task pane workspace
backend/             Optional Python analysis service and pipeline
scripts/             Fixture generation and backend utilities
tests/               Unit, component and browser tests
docs/                Workflow, architecture and operation notes
deploy/ec2/          Historical deployment templates; configure your own domains
```

Read [AGENTS.md](AGENTS.md), [DESIGN.md](DESIGN.md) and [the recorded decisions](docs/decisions.md) before changing the application. Environment files, private keys, uploads and generated build/test output must stay out of Git. This checkout has no root project `LICENSE` file; included third-party assets retain their own notices.
