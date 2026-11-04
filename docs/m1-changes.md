# M1 removal and extraction record

4 November 2026. No commit was created.

## Reusable code extracted

| Previous location                                                        | New home                                                    | Adaptation                                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/features/evidence/components/evidence-pdf.tsx`                      | `src/components/viewer/pdf-canvas.tsx` and `pdf-viewer.tsx` | PDF.js canvas, text highlight and normalized bbox retained; client-only wrapper added.          |
| `src/features/rate-grid/components/rate-grid.tsx` and `model.ts`         | `src/components/grid/virtual-table.tsx` and `navigation.ts` | Generic row virtualization and bounded arrow movement; domain columns and shading removed.      |
| `src/features/evidence/components/disposition-panel.tsx`                 | `src/components/ui/DecisionForm.tsx`                        | Action selection and required trimmed reason, with configurable labels and submission callback. |
| `src/features/tender-overview/components/tender-overview.tsx` KPI markup | `src/components/ui/SummaryCard.tsx`                         | Generic label/value/context/children composition with tabular figures.                          |
| `src/components/layout/evidence-drawer.tsx`                              | `src/components/layout/detail-drawer.tsx`                   | Generic `?detail=type:id`, Escape close and focus restoration; release placeholder content.     |

These are extractions and adaptations, rather than byte-for-byte renames.

## Cutover

Navigation now uses Overview, Documents, Drawings, Variations, Workbooks, Procurement and Audit, with Materials at the top level. Future module pages render translated release placeholders. Documents is also a placeholder: its old upload types and processing matrix depended on removed contracts; the new document hub remains Task 03. Login, session, portfolio and audit filtering/export remain usable.

User roles and the permission map, Project and AuditEvent schemas and their bootstrap mocks were updated together to the new source contracts to detach the shell from the removed domain. The complete new domain schemas and fixtures remain M2/M3. The socket transport and cache invalidation hook remain generic until M2 supplies typed events. The mock currently returns an empty audit list.

No imports remained for `@hookform/resolvers`, `react-hook-form` or `@tanstack/react-table`; these packages and their unused transitives were removed through npm. Future form/table slices can reinstall the prescribed stack when used. Virtualization, chart and PDF dependencies remain used by shared components.

Old message groups and associated nested keys were removed from both locale files, including the removed status vocabularies. Currency, unit-rate, percent and date formatting remain; the obsolete formatter and threshold configuration were removed. Transport, copy, permission, decision-form, grid navigation, audit filtering/export and formatting checks cover the surviving foundation.

## Deleted paths

The list below records removed tracked paths for this cutover. Empty scaffolds inside removed feature folders were removed with those folders. Old untracked audit tests and accessibility specs were also replaced by the surviving foundation checks and shell browser journey. The Karla tabular-numeral browser test is retained.

- `public/mock-docs/.gitkeep`
- `public/mock-docs/sample-inspection-report.pdf`
- `public/mock-docs/sample-priced-boq.pdf`
- `scripts/generate-mock-pdf.py`
- `src/app/[locale]/(app)/projects/[projectId]/flags/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/flags/page.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/pre-tender/scope-gaps/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/pre-tender/scope-gaps/page.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/reports/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/reports/page.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/tender/boq/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/tender/boq/page.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/tender/layout.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/tender/rates/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/tender/rates/page.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/tender/risk/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/tender/risk/page.tsx`
- `src/app/[locale]/(app)/projects/[projectId]/tender/scope/index.ts`
- `src/app/[locale]/(app)/projects/[projectId]/tender/scope/page.tsx`
- `src/app/[locale]/(owner)/shared/[token]/index.ts`
- `src/components/layout/evidence-drawer.tsx`
- `src/components/layout/stage-stepper.tsx`
- `src/components/layout/tender-tabs.tsx`
- `src/components/ui/status-badges.tsx`
- `src/features/documents/api.ts`
- `src/features/documents/components/document-index.tsx`
- `src/features/documents/components/documents-workspace.tsx`
- `src/features/documents/components/index.ts`
- `src/features/documents/components/progress-matrix.tsx`
- `src/features/documents/components/upload-form.tsx`
- `src/features/documents/validation.ts`
- `src/features/evidence/api.ts`
- `src/features/evidence/components/disposition-panel.tsx`
- `src/features/evidence/components/evidence-pdf.tsx`
- `src/features/evidence/components/evidence-viewer.tsx`
- `src/features/evidence/components/flag-evidence-content.tsx`
- `src/features/evidence/components/index.ts`
- `src/features/evidence/hooks/index.ts`
- `src/features/evidence/index.ts`
- `src/features/flags/api.ts`
- `src/features/flags/components/flags-inbox.tsx`
- `src/features/flags/components/index.ts`
- `src/features/flags/hooks/index.ts`
- `src/features/flags/index.ts`
- `src/features/flags/model.ts`
- `src/features/jobs/api.ts`
- `src/features/jobs/components/index.ts`
- `src/features/jobs/hooks/index.ts`
- `src/features/jobs/index.ts`
- `src/features/rate-grid/api.ts`
- `src/features/rate-grid/components/index.ts`
- `src/features/rate-grid/components/rate-grid.tsx`
- `src/features/rate-grid/hooks/index.ts`
- `src/features/rate-grid/index.ts`
- `src/features/rate-grid/model.ts`
- `src/features/reports/api.ts`
- `src/features/reports/components/auditor-notes.tsx`
- `src/features/reports/components/flagged-tenderers.tsx`
- `src/features/reports/components/index.ts`
- `src/features/reports/components/owner-report-view.tsx`
- `src/features/reports/components/recommendation-editor.tsx`
- `src/features/reports/components/report-preview.tsx`
- `src/features/reports/components/report-provenance.tsx`
- `src/features/reports/components/report-score-table.tsx`
- `src/features/reports/components/sign-off-controls.tsx`
- `src/features/reports/components/signed-versions-list.tsx`
- `src/features/reports/hooks/index.ts`
- `src/features/reports/index.ts`
- `src/features/reports/model.ts`
- `src/features/scope-gaps/api.ts`
- `src/features/scope-gaps/components/index.ts`
- `src/features/scope-gaps/components/provisional-sum-plot.tsx`
- `src/features/scope-gaps/components/scope-status-badge.tsx`
- `src/features/scope-gaps/components/scope-workspace.tsx`
- `src/features/scope-gaps/hooks/index.ts`
- `src/features/scope-gaps/index.ts`
- `src/features/scope-gaps/model.ts`
- `src/features/scores/api.ts`
- `src/features/scores/components/index.ts`
- `src/features/scores/hooks/index.ts`
- `src/features/scores/index.ts`
- `src/features/tender-overview/api.ts`
- `src/features/tender-overview/components/index.ts`
- `src/features/tender-overview/components/price-distribution-plot.tsx`
- `src/features/tender-overview/components/score-detail-panel.tsx`
- `src/features/tender-overview/components/score-signal-plot.tsx`
- `src/features/tender-overview/components/tender-overview.tsx`
- `src/features/tender-overview/hooks/index.ts`
- `src/features/tender-overview/index.ts`
- `src/features/tender-overview/model.ts`
- `src/lib/api/use-latest-project-job.ts`
- `src/mocks/fixtures/data.ts`
- `src/mocks/fixtures/inspection-pdf.ts`
- `src/mocks/fixtures/pdf-evidence.json`
- `src/mocks/fixtures/pdf.ts`
- `src/mocks/handlers/documents.ts`
- `src/mocks/handlers/flags.ts`
- `src/mocks/handlers/jobs-reports.ts`
- `src/mocks/handlers/projects.ts`
- `src/mocks/handlers/shared.ts`
- `src/mocks/ws/index.ts`
- `src/mocks/ws/simulation.ts`
- `src/schemas/document.ts`
- `src/schemas/flag.ts`
- `src/schemas/job.ts`
- `src/schemas/rate-grid.ts`
- `src/schemas/report.ts`
- `src/schemas/scope-gap.ts`
- `src/schemas/score.ts`
- `src/schemas/ws.ts`
- `tests/documents-components.test.tsx`
- `tests/e2e/documents.spec.ts`
- `tests/e2e/flags.spec.ts`
- `tests/e2e/mock-backend.spec.ts`
- `tests/e2e/rate-grid.spec.ts`
- `tests/e2e/scope-gaps.spec.ts`
- `tests/e2e/tender-overview.spec.ts`
- `tests/flag-disposition-cache.test.tsx`
- `tests/flag-disposition-components.test.tsx`
- `tests/flags-model.test.ts`
- `tests/handlers.test.ts`
- `tests/mocks.test.ts`
- `tests/permissions.test.ts`
- `tests/rate-grid-components.test.tsx`
- `tests/rate-grid.test.ts`
- `tests/reports-components.test.tsx`
- `tests/reports-model.test.ts`
- `tests/retry-handlers.test.ts`
- `tests/schemas.test.ts`
- `tests/scope-gaps.test.tsx`
- `tests/status-badges.test.tsx`
- `tests/tender-overview.test.ts`
- `tests/ws.test.ts`

## Verification

Typecheck, lint, unit tests, production build and the Playwright shell journey pass. The browser journey covers login → portfolio → overview → Documents → Audit and a direct detail URL closed with Escape. Production font fetching requires network access.

The obsolete-domain search has no matches in application source, tests, scripts, README or CONTRIBUTING. Root source-of-truth documents (`AGENTS.md`, `PRODUCT_BRIEF.md`, `DESIGN.md`) retain historical exclusions or specification terminology; removing that prose would alter the approved product instructions. Generated dependencies and framework output are not application code.
