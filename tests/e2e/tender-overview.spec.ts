import { expect, test } from "@playwright/test";

test("risk overview shows contract values and opens cited evidence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/projects/P-001/tender/risk");
  await expect(
    page.getByRole("heading", { name: "Tender overview" }),
  ).toBeVisible();
  await expect(page.getByText("+0.4σ", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "High-risk bids" }),
  ).toHaveAttribute("aria-valuenow", "3");
  await expect(
    page.getByRole("progressbar", { name: "High-risk bids" }),
  ).toHaveAttribute("aria-valuemax", "12");
  await expect(page.getByText("94.2", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("41.8", { exact: false }).first()).toBeVisible();
  const table = page.getByRole("table", {
    name: "Tender bids compared with the price benchmark",
  });
  await expect(table.getByRole("row")).toHaveCount(13);
  const apex = table.getByRole("row", { name: /Apex Foundations/ });
  await expect(apex).toContainText("−2.4σ");
  await apex.getByRole("button", { name: "Open evidence" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/evidence=F-/);
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Apex Foundations −2.4σ" }).click();
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
