# AegisQS front end

## Setup

Use Node.js 22+ and npm. Run `npm ci`, put `NEXT_PUBLIC_API_MOCKING=enabled` in `.env.local`, then run `npm run dev`. Open http://localhost:3000/en/projects/P-001/documents (or the port printed by Next). Traditional Chinese uses `/zh-HK/` instead of `/en/`.

`npm run mock:files` regenerates deterministic vector drawings and real Excel workbooks in `public/mock-files/`. They are already present. The mock login is a navigation entry point; real authentication belongs to the backend.

## See the connected workflow

1. Open **Documents**. Filter by category, search by document number/title, or enable **Conflicts only**. Open CON-004, inspect the competing file hashes, enter a reason and set one version as current as a senior QS. The drawer closes with Escape and returns focus to the document link.
2. Open **Drawings**, then **Compare revisions** on A-201 (defaults B → C). The comparison takes about ten seconds; navigating away and back preserves progress. Open the completion toast to return.
3. Try **Side by side**, **Overlay**, and **Swipe**. Drag either synchronized pane, use the swipe divider, or focus the viewer and use arrow keys to pan, +/− to zoom, and J/K to move between changes. Zoom spans 25–400%; the PDF re-renders after zoom settles. S-110 demonstrates low alignment confidence and adjustment controls.
4. On a fresh A-201 comparison, select changes 1 and 2, then **Raise potential variation (2)**. Existing snapshot changes already link to VE-007; the fresh comparison supplies unlinked changes.
5. Add current BOQ items **3.2.14** (quantity change **4.2**), **2.1.08** (**20**), and **2.4.03** (**100**). Their contract rates total **HK$186,400**. Save the cost lines. Negative quantity changes represent omissions and reduce the total. Editing a rate marks it as manual.
6. Follow a BOQ reference to its read-only source row, then its workbook version. **Open in Excel** downloads that version. **See price forecast** navigates to the material's twelve-month forecast with p10–p90 ranges and model information.
7. A senior QS can confirm or reject with a reason after saving cost edits. The register and activity data refresh without a full page reload. Open **Audit** to follow the recorded actions.

The range configuration for new or edited costs is low = total × 0.92 and high = total × 1.09. At HK$186,400, that is **HK$171,488–203,176**. The original VE-007 snapshot retains its supplied **HK$171,000–203,000** range until edited. This is an indicative demo rule, not a production estimation method.

## Uploads and mock state

Click **Upload documents**, choose or drop multiple files, then complete each file's category, document number, title, revision label, issued date and discipline. Every file has its own form and upload progress. An existing document number adds a version to that record. A newly current drawing version starts a comparison automatically and its toast offers **Compare with Rev …**.

The initial snapshot already has A-201 Rev C and BOQ v2 as current. Re-uploading those identical files deliberately creates a duplicate conflict. To demonstrate a new version from scratch, upload the sample Rev B under a new document number, then upload Rev C with that same number. Detection is simulated only for the supplied A-201 B/C and S-110 P1/P2 file pairs; arbitrary drawings are stored but cannot be analyzed by the mock.

All uploaded bytes, mutations and role selection live in memory. Client navigation preserves them; a full page reload resets the snapshot. Comparison timers keep running when changing routes, and the socket replays current progress on reconnect. Exactly one version is current; conflicts retain the existing current version until a senior QS resolves them with a reason.

## Roles

The development-only **Preview role** selector appears in the header when mocks are enabled:

- `senior_qs`: upload, compare, review, cost, confirm/reject variations and resolve document conflicts.
- `qs`: upload, compare, review and cost; cannot confirm/reject variations or resolve conflicts.
- `viewer`: read and download; no upload, review, cost-edit or decision controls.
- `admin`: organization administration and read access; project decisions still require the project role.

UI gating uses `can()`. Mock handlers enforce the same permissions. The selector changes mock identity, not production authentication; a reload resets it.

## Real API

The persistent Supabase backend, table migration, seed, real sign-in, worker and Excel add-in setup are documented in [SUPABASE.md](./SUPABASE.md). Complete that setup before disabling mocks.

Disable `NEXT_PUBLIC_API_MOCKING` and rebuild/restart Next. Serve `/api/v1` and `/ws?projectId=…` at the same origin, usually through a reverse proxy. The client sends credentials; the backend sets and validates the httpOnly cookie. Tokens are never placed in browser storage. Every JSON response and socket event is checked with Zod. `useProjectEvents(projectId)` is the sole socket subscriber and updates TanStack Query caches. The development role selector disappears with mocks disabled.

## Verification and remaining modules

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`. Browser tests cover the connected comparison/costing flow, conflicts, role controls, linked sources, focus restoration, the shell, real mock workbook parsing and axe checks on the new screens in both locales. PDF rendering loads client-side only. Hub rows virtualize through the existing shared grid component.

Documents, drawing comparison/review, variations, the portfolio, login and audit are implemented. Linked BOQ rows and workbook versions have read-only detail views; materials use the full forecast route. Procurement and project overview connect the four modules. Administration is a directional informational state; organisation user-management screens are outside the connected demo.

## Workbook upload and review

Open `/en/projects/P-001/workbooks` and choose **Upload workbook**, or open the seeded **Contract BOQ** (`WB-001`). Only `.xlsx` and `.xlsm` files are accepted. New uploads show byte progress, then parsing/checking status; the shared project socket announces check completion. Leaving the page does not stop processing.

First upload opens the three-step mapping wizard: sheet/header and 15-row preview, suggested A–F field mappings, then five parsed items. Missing or duplicated required columns block saving. **Edit mapping** opens it again for QS roles. Checks are grouped by severity and rule; **Show in sheet** selects and scrolls to the cited cell, while its corner marker opens a linkable check drawer. Ignore requires a reason; resolved/ignored checks can be reopened.

Sheet and Items virtualize rows. The browser test uploads 5,000 BOQ lines and verifies the final row, fewer than 50 mounted rows, no cell editor and an average scrolling frame interval below 50 ms. Downloads return original bytes or an annotated copy; Smart QS never edits the source workbook. Versions are discovered through existing document-version EntityLinks because the API has no workbook-version-list endpoint. The Diff tab compares any two versions; its default is previous → current.

## Workbook differences

Open a workbook and choose **Diff**. Select base/target versions, inspect added/removed/changed counts and signed item-amount change, then filter by kind, section or positive amount delta. The fixture comparison has 3 added VE-007 rows, 2 changed rates and a total change of **+HK$123,014.55**. Other changed rows expose the seeded formula/amount/reference problems. Missing/formula-error item amounts count as zero in these parsed totals; review Checks before relying on them.

VE chips open the matching variation. The totals step chart and its keyboard-accessible data table select a workbook version. **Export filtered CSV** exports the current filters. No workbook cells are edited. Matching follows sheet + item reference, with distinct duplicate occurrences preserved; a known duplicate-reference corruption may be reconciled to its same source row instead of counted as an added/removed VE item.

## Material prices and forecasts

Open `/en/materials`, filter categories or search, then **View forecast**. `/en/materials/rebar` shows observed prices, a dashed median forecast, an 80% p10–p90 band and a 95% p2.5–p97.5 band. Both bands are stacked from their own lower bounds, not from zero. The vertical line marks the latest observed period rather than inventing a current market price.

The 3/6/12-month selector changes the visible chart window and its table equivalent only. The model remains the supplied 12-month forecast; +3/+6-month glance cards stay tied to the material’s latest observed period. Every forecast median appears with its likely range. The model card reports name/version, training cut-off, mean absolute percentage backtest error and AI-labelled drivers. Backtest error strictly above 10% shows low confidence; the threshold lives in config.

**Plan a purchase** opens the shared planner for QS roles. Choose the project, quantity, need-by date and lead time; the latest order date updates live. Existing project needs and the latest saved advice prefill the inputs. A missing lead time must be entered rather than assumed. Viewer has no planning action. Material links navigate to the forecast page.

### Procurement flow

Open `/en/projects/P-001/procurement`. The rebar need links to VE-007 and starts at 4.2 tonnes. Choose **Get advice**, retain the seeded 1 June 2027 need-by date and eight-week lead time, and submit. The mock returns **Buy in window · Feb–Mar 2027**, expected cost HK$27,300 and expected saving +HK$1,470, with the supplied p10–p90 cost range and a saving range that can include a loss. These are synthetic demo forecasts, not purchase instructions.

**View selected advice on forecast** opens `/en/materials/rebar?project=P-001&advice=<id>`. The selected advice supplies the window band and the latest-order/need-by lines. Change the chart horizon to inspect the visible months; dates outside it stay in the advice card. Advice IDs are mock-session records and reset on a fresh mock backend. The exposure chart combines needs per material, sorts by p90 and includes a collapsible table. BOQ and variation source chips open their existing records.

## Reliable demo and release checks

Follow [DEMO.md](./DEMO.md). With mocks enabled in development, Start demo story prepares the pre-upload position; Reset demo data restores the exact finished fixture snapshot and clears query state and scheduled jobs. Viewers cannot use these controls. Full reloads restore the finished snapshot. Neither control exists in the production UI.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, then `npm run test:e2e`. Run typecheck after the Playwright server stops: Next regenerates the included `.next-playwright` type files during startup. Run `node scripts/report-bundles.mjs` after a production build to update [bundle-report.md](./bundle-report.md). Route-entry sizes there exclude shared/deferred chunks.

`tests/e2e/release-accessibility.spec.ts` covers every route in both locales. Chart, viewer and sheet tests also exercise text alternatives and keyboard controls. The dev identity selector does not authenticate a real backend.

## Excel task pane (P1)

The separate `/addin` npm workspace shares schemas, permissions and theme assets. See [addin/README.md](../addin/README.md) for HTTPS development, mock cookie sign-in, the approved web download/upload fallback, manifest sideload steps and the simulated-host test. Actual Microsoft 365 sideload validation remains manual.
