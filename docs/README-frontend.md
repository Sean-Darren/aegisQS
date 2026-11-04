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
6. Follow a BOQ reference to its read-only source row, then its workbook version. **Open in Excel** downloads that version. **See price forecast** opens the material's twelve-month forecast with p10–p90 ranges and model information.
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

Disable `NEXT_PUBLIC_API_MOCKING` and rebuild/restart Next. Serve `/api/v1` and `/ws?projectId=…` at the same origin, usually through a reverse proxy. The client sends credentials; the backend sets and validates the httpOnly cookie. Tokens are never placed in browser storage. Every JSON response and socket event is checked with Zod. `useProjectEvents(projectId)` is the sole socket subscriber and updates TanStack Query caches. The development role selector disappears with mocks disabled.

## Verification and remaining modules

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`. Browser tests cover the connected comparison/costing flow, conflicts, role controls, linked sources, focus restoration, the shell, real mock workbook parsing and axe checks on the new screens in both locales. PDF rendering loads client-side only. Hub rows virtualize through the existing shared grid component.

Documents, drawing comparison/review, variations, the portfolio, login and audit are implemented. Linked BOQ rows, workbook versions and material forecasts have read-only detail views. The full workbook workspace, material market/planner, procurement, project overview and admin screens remain explicit migration placeholders for their later tasks.
