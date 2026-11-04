import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("diff compares defaults, filters VE rows and selects a version from totals", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/projects/P-001/workbooks/WB-001");
  await page.getByRole("tab", { name: "Diff", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Base version", exact: true }),
  ).toHaveValue("WV-1");
  await expect(
    page.getByRole("combobox", { name: "Target version", exact: true }),
  ).toHaveValue("WV-2");
  await expect(page.getByText("+HK$123,014.55", { exact: true })).toBeVisible();
  const table = page.getByRole("table", {
    name: "Changed workbook rows",
    exact: true,
  });
  await expect(table).toBeVisible();
  await page
    .getByRole("combobox", { name: "Change kind", exact: true })
    .selectOption("added");
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(
    table.getByRole("link", { name: "VE-007", exact: true }),
  ).toHaveCount(3);
  await page.getByLabel("Cost increases only", { exact: true }).check();
  await expect(table.getByRole("row")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("Reinforcement");
  await expect(table.getByRole("row")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export filtered CSV" }).click();
  expect((await download).suggestedFilename()).toContain("WV-1-WV-2");
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Version 1", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Version", exact: true }),
  ).toHaveValue("WV-1");
  await expect(
    page.getByRole("combobox", { name: "Target version", exact: true }),
  ).toHaveValue("WV-1");
  expect(errors).toEqual([]);
});
