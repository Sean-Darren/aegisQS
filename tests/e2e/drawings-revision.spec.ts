import { test, expect } from "@playwright/test";

test("drawings register exposes an in-place Add revision action", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/drawings");

  const drawingCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "A-201 · Level 2 floor plan",
      exact: true,
    }),
  });
  await expect(drawingCard).toBeVisible();

  const addRevision = drawingCard.getByRole("button", {
    name: "Add revision",
    exact: true,
  });
  await expect(addRevision).toBeVisible();
  await addRevision.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Add revision for A-201",
      exact: true,
    }),
  ).toBeVisible();

  await dialog
    .locator('input[type="file"]')
    .setInputFiles("public/mock-files/drawings/A-201-rev-B.pdf");

  await expect(
    dialog.getByLabel("Revision label", { exact: true }),
  ).toBeVisible();
});
