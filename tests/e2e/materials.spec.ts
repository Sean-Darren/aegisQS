import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("material list opens ranged forecasts, changes horizon and exposes model basis", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/materials");
  await expect(
    page.getByRole("link", { name: "View forecast", exact: true }),
  ).toHaveCount(10);
  await page.getByLabel("Search materials", { exact: true }).fill("rebar");
  await expect(
    page.getByRole("link", { name: "View forecast", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "View forecast", exact: true }).click();
  await expect(page).toHaveURL(/\/materials\/rebar$/);
  await expect(
    page.getByRole("heading", {
      name: "High-tensile steel rebar",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Historical prices and median forecast/ }),
  ).toBeVisible();
  await page.getByText("Show price data table", { exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(73);
  await page.getByRole("radio", { name: "3 months", exact: true }).click();
  await expect(table.getByRole("row")).toHaveCount(64);
  await expect(page.getByText(/Likely .*tonne by Apr 2027/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Forecast model", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Plan a purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Preview role" })
    .selectOption("viewer");
  await expect(
    page.getByRole("combobox", { name: "Preview role" }),
  ).toHaveValue("viewer");
  await expect(
    page.getByRole("button", { name: "Plan a purchase", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("material routes have no serious or critical axe findings in both locales", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const locale of ["en", "zh-HK"])
    for (const path of ["/materials", "/materials/rebar"]) {
      await page.goto(`/${locale}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: /Preview role|預覽角色/ }),
      ).toBeVisible();
      if (path.endsWith("/rebar"))
        await expect(
          page.getByRole("img", { name: /Historical prices|歷史價格及預測/ }),
        ).toBeVisible();
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
    }
});
