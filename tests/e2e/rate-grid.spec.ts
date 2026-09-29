import { expect, test } from "@playwright/test";

test("rates grid loads cursor pages, filters columns, opens evidence, and exports the view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/projects/P-001/tender/rates");
  await expect(
    page.getByRole("heading", { name: "Bid comparison rates" }),
  ).toBeVisible();
  const grid = page.getByRole("grid", { name: "BOQ rates by tenderer" });
  await expect(
    grid.getByRole("columnheader", { name: "BuildCorp HK Ltd." }),
  ).toBeVisible();
  await expect(page.getByText(/100 of [35],000 rows loaded/)).toBeVisible();
  await expect(
    grid.getByText("Insufficient benchmark data").first(),
  ).toBeVisible();
  const first = grid.locator('[data-grid-row="0"][data-grid-column="0"]');
  await first.focus();
  for (let index = 0; index < 7; index++)
    await page.keyboard.press("ArrowRight");
  await expect(
    grid.locator('[data-grid-row="0"][data-grid-column="7"]'),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/evidence=F-001/);
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const scroller = grid.locator("..");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByText(/200 of [35],000 rows loaded/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Flagged only" }).check();
  await expect(page.getByText(/150 of 150 rows loaded/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Flagged only" }).uncheck();
  await page
    .getByRole("combobox", { name: "Trade" })
    .selectOption("concrete repair");
  await expect(page.getByText(/of 375 rows loaded/)).toBeVisible();
  await page.getByText(/Tenderers \(12\)/).click();
  await page.getByRole("checkbox", { name: "Apex Foundations" }).uncheck();
  await expect(
    grid.getByRole("columnheader", { name: "Apex Foundations" }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export current view to CSV" })
    .click();
  expect((await download).suggestedFilename()).toBe("P-001-rates.csv");
  expect(errors).toEqual([]);
});

test("5,000-row fixture keeps rendered rows bounded while loading to the end", async ({
  page,
}) => {
  test.setTimeout(120000);
  test.skip(
    process.env.NEXT_PUBLIC_MOCK_GRID_ROWS !== "5000",
    "Run with NEXT_PUBLIC_MOCK_GRID_ROWS=5000",
  );
  await page.goto("/en/projects/P-001/tender/rates");
  const grid = page.getByRole("grid", { name: "BOQ rates by tenderer" });
  const scroller = grid.locator("..");
  for (let loaded = 100; loaded < 5000; loaded += 100) {
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      page.getByText(`${Math.min(loaded + 100, 5000).toLocaleString("en-US")} of 5,000 rows loaded`),
    ).toBeVisible();
    expect(
      await grid.locator("tbody tr:has(td[data-grid-row])").count(),
    ).toBeLessThan(80);
  }
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(grid.locator('[data-grid-row="4999"][data-grid-column="0"]')).toBeVisible();
});
