import { test, expect } from "@playwright/test";
test("connected five-minute demo", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/projects/P-001/overview");
  await page
    .getByRole("button", { name: "Start demo story", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Needs attention", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No activity yet. Upload a document to begin the project record.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start demo story", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page
    .getByRole("button", { name: "Upload documents", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/mock-files/drawings/A-201-rev-C.pdf");
  await page.getByLabel("Document number", { exact: true }).fill("A-201");
  await page.getByLabel("Revision label", { exact: true }).fill("C");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await page
    .getByRole("button", { name: "Compare with Rev B", exact: true })
    .click();
  await expect(page.getByTestId("comparison-canvas")).toBeVisible({
    timeout: 25000,
  });
  await page.getByRole("radio", { name: "Overlay", exact: true }).click();
  await expect(page.locator("[data-change-cloud]")).toHaveCount(4);
  // Keyboard-only viewer interactions: pan, zoom, change navigation and swipe.
  const viewer = page.locator('section[tabindex="0"]');
  await viewer.focus();
  for (const key of ["ArrowRight", "ArrowDown", "+", "-", "j", "k"])
    await viewer.press(key);
  await page.getByRole("radio", { name: "Swipe", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider")).toHaveValue("51");
  await page
    .getByRole("checkbox", { name: "Select change 1", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Select change 2", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Raise potential variation (2)", exact: true })
    .click();
  await expect(page).toHaveURL(/variations\/VE-007$/);
  for (const [ref, quantity] of [
    ["3.2.14", "4.2"],
    ["2.1.08", "20"],
    ["2.4.03", "100"],
  ]) {
    const combo = page.getByRole("combobox", {
      name: "Add BOQ item",
      exact: true,
    });
    await combo.fill(ref);
    await page
      .getByRole("option", { name: new RegExp(ref) })
      .first()
      .waitFor();
    await combo.press("Enter");
    await page
      .getByRole("spinbutton", { name: `${ref} Quantity change`, exact: true })
      .fill(quantity);
  }
  await expect(page.getByText("HK$186,400.00", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Save cost lines", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save cost lines", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Procurement", exact: true }).click();
  const rebar = page.getByRole("row").filter({
    has: page.getByRole("link", {
      name: "High-tensile steel rebar",
      exact: true,
    }),
  });
  await expect(rebar).toContainText("4.2 tonne");
  await expect(
    rebar.getByRole("link", { name: "Variation · VE-007" }),
  ).toBeVisible();
  await rebar.getByRole("button", { name: "Get advice", exact: true }).click();
  const planner = page.getByRole("dialog");
  await planner.getByLabel("Need-by date", { exact: true }).fill("2027-06-01");
  await planner
    .getByRole("spinbutton", { name: "Lead time (weeks)" })
    .fill("8");
  await planner
    .getByRole("button", { name: "Get advice", exact: true })
    .click();
  await expect(planner).toHaveCount(0);
  await expect(
    page
      .getByRole("article")
      .getByRole("heading", { name: /Buy in window · Feb–Mar 2027/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Workbooks", exact: true }).click();
  await page.getByRole("link", { name: "Contract BOQ", exact: true }).click();
  await page
    .getByRole("button", { name: "Upload new version", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/mock-files/workbooks/boq-v2.xlsx");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page).toHaveURL(/version=WV-/);
  await expect(page.getByText("Checked", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole("button", { name: /BOQ!F40/ })).toBeVisible();
  await page.getByRole("tab", { name: "Diff", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Change kind", exact: true })
    .selectOption("added");
  await expect(
    page
      .getByRole("table", { name: "Changed workbook rows", exact: true })
      .getByRole("row"),
  ).toHaveCount(4);
  await page.getByRole("link", { name: "Audit", exact: true }).click();
  await page.getByLabel("Action", { exact: true }).fill("");
  await page.getByLabel("Actor", { exact: true }).fill("user");
  for (const text of [
    /uploaded/i,
    /Comparison ready/i,
    /potential variation/i,
    /cost.*updated/i,
    /Procurement advice saved/i,
    /Workbook checks completed/i,
  ])
    await expect(page.getByRole("main").getByText(text).first()).toBeVisible();
  expect(errors).toEqual([]);
});
