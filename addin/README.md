# Smart QS Excel task pane

A separate React/Next application in the root npm workspace. Only shared schemas, the canonical can() permission policy and design assets are imported into its UI; the development server reuses the existing MSW backend implementation. Nothing writes Excel cell values, formulas or formatting. The Office adapter only reads a compressed file on supported desktop hosts, activates a sheet and selects a cell.

## Install and serve

From the repository root:

```sh
npm ci
npm run dev --workspace smart-qs-excel-addin
```

Create `addin/.env.local` first:

```dotenv
ADDIN_API_MOCKING=enabled
```

The dev server is **https://localhost:3200**. Next's experimental HTTPS mode generates a development certificate; follow its local trust instructions. Trust/install that local certificate yourself and visit the URL once before sideloading. Do not use an HTTP manifest or bypass an untrusted certificate inside the Office iframe. No additional dependencies or lockfiles are needed; install from the root only.

The default mock session is Senior QS. Mock storage lives in this server process and resets when it restarts. It is separate from the Next app's browser MSW session, although the handlers, fixtures and contracts are shared.

## Sideload in Excel on the web

1. Sign in to Excel on the web and open `public/mock-files/workbooks/boq-v2.xlsx` in an editable workbook.
2. Open Add-ins / More Add-ins → My Add-ins → Upload My Add-in and select `addin/manifest.xml`. Your tenant must permit developer sideloading. If using a deployed host, replace **all** localhost URLs and AppDomain in the manifest with its trusted HTTPS origin.
3. Open the task pane. Sign in → Finish sign in in the Office dialog. The mock endpoint sets an httpOnly cookie. The dialog sends only a one-time nonce; the task pane verifies `/me`. If your browser partitions cookies, use **Allow cookie access** after signing in, or allow this trusted site through browser settings. No token is kept in browser storage.
4. Choose P-001 / Contract BOQ. The pane attempts to read AegisQS workbook metadata automatically; if no identity metadata is present, enter the version number of the actual open copy (for the sample, 2). This fallback association is **user-confirmed**, not a detected file identity. An unverified file always produces a warning on Check Version.
5. Check this workbook loads the current Smart QS version's checks. Confirm that this matches the open file, then select a check such as BOQ!F40. Selection is disabled until the declared open version matches the displayed current version. Only the active sheet/selection changes.
6. Save New Version on the web uses the approved explicit fallback: download a copy using Excel's own menu, choose that `.xlsx` or `.xlsm` copy in the pane, confirm that the copy matches the open workbook, then Save New Version. Microsoft does not expose compressed workbook export via Office.js in Excel on the web. Supported desktop hosts export file slices directly, with the handle closed after reading.
7. Check Version refreshes the current AegisQS version and updates the version status panel with the explicit open/latest version state. It does not replace cells or claim to pull anything into Excel. Use **Download Latest** to download the authoritative copy separately. Duplicate uploads can be stored as conflicts by the hub and need not become current; the pane displays the server's current version after saving.

## Real cookie authentication

Remove `ADDIN_API_MOCKING` and set:

```dotenv
SMART_QS_API_ORIGIN=https://your-api.example
SMART_QS_LOGIN_URL=/login
```

Deploy the task pane and sign-in callback under one HTTPS origin. Route `/login` to the existing backend login UI, or set the configured login URL to its approved sign-in entry. The login service must honour the `returnTo` callback, set a valid host-only httpOnly cookie for the task-pane/proxy origin, and return to `/signin?nonce=...&locale=...`. Finish sign in verifies `/me` before signalling the parent. The `/api/v1` server proxy forwards that cookie; it does not manufacture a production JWT. Cross-site Office iframe usage requires Secure/SameSite=None cookies and browser storage-access policy support. Backend cookie domains and CSRF origin checks must match the deployed origin. The mock sign-in endpoint is absent when mock mode is off.

The add-in-only manifest requests ReadWriteDocument for Excel rich API access. Despite that platform permission, this implementation never assigns range values/formulas, inserts worksheets, or overwrites the open workbook. Office.js disables browser history methods; the layout preserves/restores them around loading Office.js, following Microsoft's framework guidance.

## Verification

```sh
npm run build --workspace smart-qs-excel-addin
npm run typecheck --workspace smart-qs-excel-addin
npx playwright test --config addin/playwright.config.ts
npm test -- tests/addin-office.test.ts
```

Playwright starts a built production server on HTTP localhost **only for simulation** and replaces the Office CDN with a test adapter. It tests cookie dialog, project/workbook API, real XLSX upload, check-cell selection and stale-version warning. It does not constitute a real Excel sideload. Run the manual HTTPS sequence above in your Microsoft 365 tenant to validate host permissions, popup/cookie policies and certificate trust. No authenticated Excel host was available during implementation.

Karla is self-hosted from the same Google Fonts font used by the app, licensed under the included SIL OFL. Theme variables import the canonical `src/app/globals.css`. UI labels are in `addin/messages/en.json` and `zh-HK.json`; raw Office/backend diagnostic messages are shown separately from translated guidance.

References: [File export platform support](https://learn.microsoft.com/en-us/javascript/api/office/office.document?view=office-js), [Office dialog authentication](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/auth-with-office-dialog-api), [Sideloading](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing), [framework/history compatibility](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/connect-to-javascript-frameworks).

## Persistent Supabase backend

Follow [the main Supabase setup](../docs/SUPABASE.md) first. Set `ADDIN_API_MOCKING=disabled` and `SMART_QS_API_ORIGIN` to the main app origin. The built-in `/login` page uses the backend login endpoint through the add-in origin, retaining httpOnly cookies. Do not set a Supabase secret key in the add-in. The original dialog, explicit web download/upload, cell-selection and Check Version flows then use the real persistent workbook endpoints. Real Excel sideload/cookie behaviour must still be verified in Microsoft 365.
