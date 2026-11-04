import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("foundation shell and drawer have no serious or critical accessibility findings", async ({
  page,
}) => {
  for (const route of [
    "/en/projects/P-001/documents",
    "/en/projects/P-001/documents?detail=document:D-1",
  ]) {
    await page.goto(route);
    if (route.includes("?"))
      await expect(page.getByRole("dialog")).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: "Documents", exact: true }),
      ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  }
});
