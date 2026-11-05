# Production bundle inspection

Gzip KiB, measured with Node zlib after `npm run build`. Route entries exclude shared framework/runtime chunks and deferred imports: these are **not** total first-load sizes.

| Route entry                                                          | Gzip KiB |
| -------------------------------------------------------------------- | -------: |
| /[locale]/(app)/admin                                                |      0.4 |
| /[locale]/(app)/materials/[materialId]                               |      0.2 |
| /[locale]/(app)/materials                                            |      0.2 |
| /[locale]/(app)/projects/[projectId]/audit                           |      0.8 |
| /[locale]/(app)/projects/[projectId]/documents/[documentId]          |      0.8 |
| /[locale]/(app)/projects/[projectId]/documents                       |      0.8 |
| /[locale]/(app)/projects/[projectId]/drawings/compare/[comparisonId] |      0.2 |
| /[locale]/(app)/projects/[projectId]/drawings                        |      0.2 |
| /[locale]/(app)/projects/[projectId]/overview                        |      2.7 |
| /[locale]/(app)/projects/[projectId]/procurement                     |      0.2 |
| /[locale]/(app)/projects/[projectId]/variations/[variationId]        |      0.2 |
| /[locale]/(app)/projects/[projectId]/variations                      |      0.2 |
| /[locale]/(app)/projects/[projectId]/workbooks/[workbookId]          |      1.6 |
| /[locale]/(app)/projects/[projectId]/workbooks                       |      1.6 |
| /[locale]/(app)/projects                                             |      2.5 |
| /[locale]/(auth)/login                                               |      0.4 |
| /[locale]                                                            |      0.3 |
| /_global-error                                                       |      0.1 |
| /_not-found                                                          |      1.0 |

## Deferred modules

The webpack loadable manifest confirms separate chunks for the following modules. Figures sum each module’s listed JS chunks; shared chunks can occur in several rows.

| Module                                                                                    | Gzip KiB |
| ----------------------------------------------------------------------------------------- | -------: |
| components/viewer/pdf-viewer.tsx -> ./pdf-canvas                                          |    193.5 |
| features/drawings/components/comparison-page.tsx -> @/components/viewer/comparison-canvas |    209.9 |
| features/materials/components/material-forecast-page.tsx -> ./fan-chart                   |    222.1 |
| features/procurement/components/procurement-page.tsx -> ./exposure-chart                  |    221.1 |
| features/workbooks/components/diff-tab.tsx -> ./version-totals-chart                      |    220.9 |
| mocks/handlers/workbooks.ts -> exceljs                                                    |    249.7 |
| mocks/provider.tsx -> ./browser                                                           |    286.8 |
| mocks/workbook-engine.ts -> exceljs                                                       |    249.7 |

PDF worker assets are loaded by PDF.js on viewer demand. Mock fixture/file bytes and ExcelJS are mock-only deferred costs; disable mocking for the real API. No route-size budget is specified in AGENTS.md.
