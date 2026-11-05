import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("project overview links modules and audit filters export the visible history", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/overview");
  await expect(
    page.getByRole("heading", { name: "Needs attention", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Open documents",
    "Open drawings",
    "Open variations",
    "Open workbooks",
  ])
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "CON-004: resolve version conflict" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.getByRole("link", { name: "View full audit trail" }).click();
  await page.getByLabel("Action", { exact: true }).fill("comparison.completed");
  await expect(
    page.getByText("Comparison ready — four changes found", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export filtered CSV", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("audit-P-001");
  await page.getByRole("link", { name: "View CMP-A201" }).click();
  await expect(page).toHaveURL(/drawings\/compare\/CMP-A201/);
  await expect(
    page.getByRole("heading", { name: "Activity", exact: true }),
  ).toBeVisible();
});
