import { test, expect } from "@playwright/test";
test("remaining shell routes and detail URL work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/login");
  await page.getByRole("link", { name: "Continue to projects" }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Central Market Rehab Phase 2",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "A-201", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Audit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit log", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "BOQ checks completed; formula and amount problems require review",
    ),
  ).toBeVisible();
  await page.goto("/en/projects/P-001/documents?detail=document:D-1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).not.toHaveURL(/detail=/);
  expect(errors).toEqual([]);
});
