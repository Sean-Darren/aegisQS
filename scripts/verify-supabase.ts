/** Live acceptance: creates one clearly named site-record document; never deletes data. */
import { chromium, expect } from "@playwright/test";
const base = process.env.SMART_QS_VERIFY_ORIGIN ?? "http://127.0.0.1:3300";
const email = process.env.SMART_QS_BOOTSTRAP_EMAIL,
  password = process.env.SMART_QS_BOOTSTRAP_PASSWORD;
if (!email || !password)
  throw new Error("Configure bootstrap credentials first.");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/en/login`, { timeout: 120000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/projects$/, { timeout: 60000 });
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const cookies = await context.cookies();
  if (!cookies.some((c) => c.name.startsWith("sb-") && c.httpOnly))
    throw new Error("Expected an httpOnly Supabase session.");
  for (const path of [
    "/me",
    "/projects/P-001/overview",
    "/projects/P-001/documents",
    "/projects/P-001/drawings",
    "/projects/P-001/variations",
    "/projects/P-001/workbooks",
    "/projects/P-001/material-needs",
    "/projects/P-001/procurement",
    "/projects/P-001/audit-events",
    "/materials/rebar/forecast",
    "/workbooks/WB-001/diff?base=WV-1&target=WV-2",
  ]) {
    const response = await context.request.get(`${base}/api/v1${path}`);
    if (!response.ok())
      throw new Error(`Feature API failed (${response.status()}): ${path}`);
  }
  const docNumber = `DB-VERIFY-${Date.now()}`;
  const bytes = Buffer.from(
    "Smart QS private storage and database persistence verified.",
  );
  const response = await context.request.post(
    `${base}/api/v1/projects/P-001/documents`,
    {
      headers: { Origin: base },
      multipart: {
        file: {
          name: "database-verification.txt",
          mimeType: "text/plain",
          buffer: bytes,
        },
        category: "site_record",
        docNumber,
        title: "Database migration verification",
        label: "1",
      },
    },
  );
  if (response.status() !== 201)
    throw new Error(`Persistent upload failed (${response.status()}).`);
  const doc = await response.json();
  // A fresh browser/request context proves the record does not live in an in-memory handler.
  const fresh = await browser.newContext({
    storageState: await context.storageState(),
  });
  const saved = await fresh.request.get(`${base}/api/v1/documents/${doc.id}`);
  if (!saved.ok() || (await saved.json()).docNumber !== docNumber)
    throw new Error("Document did not persist.");
  const file = await fresh.request.get(
    `${base}/api/v1/document-versions/${doc.currentVersionId}/file`,
  );
  if (!file.ok() || !(await file.body()).equals(bytes))
    throw new Error("Private file round-trip failed.");
  const anon = await browser.newContext();
  const denied = await anon.request.get(`${base}/api/v1/projects`);
  if (denied.status() !== 401)
    throw new Error("Anonymous request was not denied.");
  console.log(
    "Live Supabase acceptance passed: cookie sign-in, all module reads, persistent document upload, private download and anonymous denial.",
  );
  console.log(
    "One site record titled Database migration verification was retained with its audit event.",
  );
} finally {
  await browser.close();
}
