import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("foundation shell and drawer have no serious or critical accessibility findings", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const route of [
    "/en/projects/P-001/documents",
    "/en/projects/P-001/documents?detail=document:D-16",
    "/en/projects/P-001/documents/D-A201",
    "/en/projects/P-001/drawings",
    "/en/projects/P-001/drawings/compare/CMP-A201",
    "/en/projects/P-001/variations",
    "/en/projects/P-001/variations/VE-007",
    "/zh-HK/projects/P-001/documents",
    "/zh-HK/projects/P-001/drawings/compare/CMP-A201",
    "/zh-HK/projects/P-001/variations/VE-007",
  ]) {
    await page.goto(route);
    if (route.includes("?"))
      await expect(page.getByRole("dialog")).toBeVisible();
    else await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (!route.includes("?"))
      await expect(
        page.getByRole("combobox", { name: /Preview role|預覽角色/ }),
      ).toBeVisible();
    if (route.includes("?"))
      await expect(
        page.getByRole("dialog").getByRole("heading", { level: 1 }),
      ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  }
});
