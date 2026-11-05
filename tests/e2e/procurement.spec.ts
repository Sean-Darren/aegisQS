import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("VE-007 material need creates ranged rebar advice and opens its forecast overlay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(message.text());
  });
  await page.goto("/en/projects/P-001/procurement");
  await page.getByRole("combobox", { name: "Preview role" }).selectOption("qs");
  const rebar = page.getByRole("row").filter({
    has: page.getByRole("link", {
      name: "High-tensile steel rebar",
      exact: true,
    }),
  });
  await expect(
    rebar.getByRole("link", { name: "Variation · VE-007" }),
  ).toBeVisible();
  await expect(rebar).toContainText("4.2 tonne");
  await rebar.getByRole("button", { name: "Get advice", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("spinbutton", { name: "Quantity (tonne)" }),
  ).toHaveValue("4.2");
  await expect(dialog.getByLabel("Need-by date", { exact: true })).toHaveValue(
    "2027-06-01",
  );
  await expect(
    dialog.getByText("Latest order date: 6 Apr 2027", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "Lead time (weeks)" }).fill("9");
  await expect(
    dialog.getByText("Latest order date: 30 Mar 2027", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "Lead time (weeks)" }).fill("8");
  await dialog.getByRole("button", { name: "Get advice", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.getByRole("article", {
    name: "Procurement advice for High-tensile steel rebar",
  });
  await expect(
    card.getByRole("heading", { name: /Buy in window · Feb–Mar 2027/ }),
  ).toBeVisible();
  await expect(card.getByText("+HK$1,470.00", { exact: true })).toBeVisible();
  await expect(card.getByText(/Likely range:/)).toBeVisible();
  await page
    .getByRole("link", {
      name: "View selected advice on forecast",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/materials\/rebar\?project=P-001&advice=PA-/);
  await expect(
    page.getByRole("img", { name: /Historical prices and median forecast/ }),
  ).toBeVisible();
  await expect(card).toContainText("Feb–Mar 2027");
  await expect(card).toContainText("Latest order date 6 Apr 2027");
  await page
    .getByRole("button", { name: "Plan a purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Plan a purchase", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("combobox", { name: "Preview role" })
    .selectOption("viewer");
  await expect(
    page.getByRole("button", { name: "Plan a purchase", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Select project", exact: true })
    .selectOption("P-001");
  await page.getByRole("link", { name: "Procurement", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Material needs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Get advice", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("procurement and purchase planner have no serious or critical accessibility findings", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const locale of ["en", "zh-HK"]) {
    await page.goto(`/${locale}/projects/P-001/procurement`);
    await expect(
      page.getByRole("img", { name: /Material exposure|材料成本風險圖/ }),
    ).toBeVisible();
    let result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
    await page
      .getByRole("button", { name: /Get advice|取得建議/, exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").getByRole("spinbutton").first(),
    ).toHaveValue("4.2");
    result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
    await page.keyboard.press("Escape");
  }
});
