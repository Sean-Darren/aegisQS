import { expect, test } from "@playwright/test";

test("upload a document, run analysis, and return to live progress", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  await page.goto("/en/projects/P-001/documents");
  await expect(
    page.getByRole("heading", { name: "Tender documents" }),
  ).toBeVisible();
  const index = page.getByRole("region", { name: "Document index" });
  await expect(index.getByRole("table").getByRole("row")).toHaveCount(13);
  await page.getByLabel("Choose files").setInputFiles([
    {
      name: "inspection-note.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("sample document"),
    },
    {
      name: "qualification.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("second document"),
    },
  ]);
  await page
    .getByRole("combobox", { name: "Document type" })
    .nth(0)
    .selectOption("inspection_report");
  await page
    .getByRole("combobox", { name: "Document type" })
    .nth(1)
    .selectOption("tender_qualification");
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await expect(
    index.getByRole("link", { name: "inspection-note.pdf" }),
  ).toBeVisible();
  await expect(
    index.getByRole("link", { name: "qualification.pdf" }),
  ).toBeVisible();
  await expect(page.getByText("Uploaded", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis progress" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /Analysis \d+% complete/ }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Projects" })
    .getByRole("link", { name: "Projects" })
    .click();
  await page.waitForTimeout(2500);
  await expect(
    page.getByRole("status").filter({ hasText: /Analysis [1-9]\d*% complete/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open project" }).click();
  await page
    .getByRole("navigation", { name: "Projects" })
    .getByRole("link", { name: "Documents" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Analysis progress" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /Analysis [1-9]\d*% complete/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Analysis complete", { exact: true }).first(),
  ).toBeVisible({ timeout: 25000 });
  await expect(
    page.getByRole("link", { name: "View Tender overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
