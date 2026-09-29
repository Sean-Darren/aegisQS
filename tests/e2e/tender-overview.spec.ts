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

test("score detail compares tenderers and opens a signal flag", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/projects/P-001/tender/risk");
  await page.getByRole("button", { name: "Explain score" }).first().click();
  await expect(page).toHaveURL(/tenderer=T-001/);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Compliance Score for BuildCorp HK Ltd.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Static weights")).toBeVisible();
  const scoreTable = page.getByRole("table", {
    name: "Signal contribution, weight, and raw value for each tenderer",
  });
  await expect(scoreTable.getByRole("row")).toHaveCount(8);
  await page.getByLabel("Compare with tenderer").selectOption("T-002");
  await expect(page).toHaveURL(/compare=T-002/);
  await expect(
    scoreTable.getByRole("columnheader", { name: "Apex Foundations" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Unit rate requires review/ })
    .first()
    .click();
  await expect(page).toHaveURL(/evidence=F-/);
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a signal without benchmark data shows no point contribution", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/tender/risk?tenderer=T-006");
  const scoreTable = page.getByRole("table", {
    name: "Signal contribution, weight, and raw value for each tenderer",
  });
  await expect(
    scoreTable.getByRole("row", { name: /News sentiment/ }),
  ).toContainText("Insufficient benchmark data");
  await expect(
    scoreTable.getByRole("row", { name: /News sentiment/ }),
  ).not.toContainText("points");
});
