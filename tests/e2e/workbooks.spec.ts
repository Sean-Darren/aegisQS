import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("upload, map, review seeded checks and navigate read-only cells", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/projects/P-001/workbooks");
  await page
    .getByRole("button", { name: "Upload workbook", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/mock-files/workbooks/boq-v2.xlsx");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Column mapping" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    dialog.getByRole("combobox", { name: "Amount", exact: true }),
  ).toHaveValue("F");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save mapping", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Checked", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /BOQ!F30/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /BOQ!F40/ })).toBeVisible();
  const mismatch = page
    .getByRole("article")
    .filter({ has: page.getByRole("button", { name: /BOQ!F40/ }) });
  await mismatch.getByRole("button", { name: "Show in sheet" }).click();
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  await expect(grid.locator("[aria-selected=true]")).toContainText(/\d/);
  await expect(
    grid.getByRole("button", { name: /error: BOQ!F40/i }),
  ).toBeVisible();
  await grid.getByRole("button", { name: /error: BOQ!F40/i }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "BOQ!F40" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    grid.getByRole("button", { name: /error: BOQ!F40/i }),
  ).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.getByRole("combobox", { name: "Preview role" }).selectOption("qs");
  await expect(
    page.getByRole("combobox", { name: "Preview role" }),
  ).toHaveValue("qs");
  await expect(
    page.getByRole("button", { name: "Edit mapping" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Checks", exact: true }).click();
  await mismatch.getByRole("button", { name: "Ignore", exact: true }).click();
  await mismatch
    .getByLabel("Reason", { exact: true })
    .fill("Verified against the source Excel calculations.");
  await mismatch
    .getByRole("button", { name: "Ignore", exact: true })
    .last()
    .click();
  await expect(mismatch.getByText("Ignored", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Preview role" })
    .selectOption("viewer");
  await expect(
    page.getByRole("combobox", { name: "Preview role" }),
  ).toHaveValue("viewer");
  await expect(page.getByRole("button", { name: "Edit mapping" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Mark resolved" })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("5000-row workbook keeps the sheet DOM virtualized and cells read-only", async ({
  page,
}) => {
  test.setTimeout(120000);
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();
  const sheet = workbook.addWorksheet("BOQ");
  sheet.addRow([
    "Item ref",
    "Description",
    "Unit",
    "Quantity",
    "Rate",
    "Amount",
    "Section",
  ]);
  for (let row = 1; row <= 5000; row++)
    sheet.addRow([
      `L-${row}`,
      `Large workbook line ${row}`,
      "m",
      row,
      10,
      { formula: `D${row + 1}*E${row + 1}`, result: row * 10 },
      "Test section",
    ]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  await page.goto("/en/projects/P-001/workbooks");
  await page
    .getByRole("button", { name: "Upload workbook", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "5000-rows.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Sheet", exact: true }).click();
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  await expect(grid).toHaveAttribute("aria-rowcount", "5002");
  await grid.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(
    grid.getByRole("button", { name: "Large workbook line 5000", exact: true }),
  ).toBeVisible();
  expect(await grid.getByRole("row").count()).toBeLessThan(50);
  expect(await grid.locator("input,[contenteditable=true]").count()).toBe(0);
  const frameMs = await grid.evaluate(async (e) => {
    const times: number[] = [];
    let previous = performance.now();
    for (let i = 0; i < 30; i++) {
      e.scrollTop = i * 1000;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const now = performance.now();
      times.push(now - previous);
      previous = now;
    }
    return times.reduce((a, b) => a + b, 0) / times.length;
  });
  expect(frameMs).toBeLessThan(50);
});
