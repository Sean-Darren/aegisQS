import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const routes = [
  "",
  "/login",
  "/projects",
  "/projects/P-001/overview",
  "/projects/P-001/documents",
  "/projects/P-001/documents/D-A201",
  "/projects/P-001/drawings",
  "/projects/P-001/drawings/compare/CMP-A201",
  "/projects/P-001/variations",
  "/projects/P-001/variations/VE-007",
  "/projects/P-001/workbooks",
  "/projects/P-001/workbooks/WB-001",
  "/projects/P-001/procurement",
  "/projects/P-001/audit",
  "/materials",
  "/materials/rebar",
  "/admin",
];
for (const locale of ["en", "zh-HK"])
  for (const route of routes)
    test(`axe ${locale}${route || "/"}`, async ({ page }) => {
      await page.goto(`/${locale}${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (route && route !== "/login")
        await expect(
          page.getByRole("combobox", { name: /Preview role|預覽角色/ }),
        ).toBeVisible();
      if (route.includes("/compare/"))
        await expect(page.getByTestId("comparison-canvas")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
    });
