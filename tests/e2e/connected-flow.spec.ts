import { test, expect } from "@playwright/test";
test("document conflict resolves with exactly one current version", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/documents");
  await page.getByLabel("Conflicts only").check();
  await page.getByRole("link", { name: "CON-004", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Version conflict requires review"),
  ).toBeVisible();
  await expect(dialog.getByText("Current", { exact: true })).toHaveCount(1);
  await dialog
    .getByLabel("Reason", { exact: true })
    .first()
    .fill("Verified the issued conditions with the project records.");
  await dialog
    .getByRole("button", { name: "Set as current", exact: true })
    .first()
    .click();
  await expect(
    dialog.getByText("Version conflict requires review"),
  ).not.toBeVisible();
  await expect(dialog.getByText("Current", { exact: true })).toHaveCount(1);
});
test("comparison, review and three BOQ lines produce an indicative variation", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/projects/P-001/drawings");
  const drawing = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "A-201 · Level 2 floor plan",
      exact: true,
    }),
  });
  await drawing
    .getByRole("button", { name: "Compare revisions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Comparing revisions", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("comparison-canvas")).toBeVisible({
    timeout: 25000,
  });
  await expect
    .poll(
      () =>
        page
          .locator('canvas[role="img"]')
          .first()
          .evaluate((node: HTMLCanvasElement) => node.width),
      { timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(640);
  await page.getByRole("radio", { name: "Overlay", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Select change/ }),
  ).toHaveCount(4);
  await page.screenshot({ path: "/tmp/qs-comparison-overlay.png" });
  await page
    .getByRole("button", { name: "Zoom out", exact: true })
    .click({ clickCount: 3 });
  await expect(page.getByText("25%", { exact: true })).toBeVisible();
  for (let i = 0; i < 15; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("400%", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Swipe", exact: true }).click();
  const slider = page.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("51");
  const viewer = page.locator('section[tabindex="0"]');
  await viewer.focus();
  await viewer.press("j");
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Additional beam added",
      exact: true,
    }),
  ).toBeVisible();
  await viewer.press("k");
  await page
    .getByRole("checkbox", { name: "Select change 1", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Select change 2", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Raise potential variation (2)", exact: true })
    .click();
  await expect(page).toHaveURL(/\/variations\/VE-/);
  // Seeded cost lines from AI-matched materials produce a non-zero indicative cost.
  const costBefore = page.locator('p.text-3xl.font-bold.tabular-nums');
  await expect(costBefore).toBeVisible();
  const beforeText = await costBefore.textContent();
  expect(beforeText).toBeTruthy();
  expect(beforeText).not.toBe('HK$0.00');
  // Add manual BOQ items on top of seeded lines.
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
      .locator(`input[aria-label*="${ref}"]`)
      .fill(quantity);
  }
  // Verify cost is still non-zero and has changed from seeded baseline.
  const costAfter = page.locator('p.text-3xl.font-bold.tabular-nums');
  await expect(costAfter).toBeVisible();
  const afterText = await costAfter.textContent();
  expect(afterText).toBeTruthy();
  expect(afterText).not.toBe(beforeText);
  expect(afterText).not.toBe('HK$0.00');
  await page
    .getByRole("button", { name: "Save cost lines", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save cost lines", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Verified quantities against the current contract BOQ.");
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("QS and viewer controls, linked sources and drawer focus", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/documents");
  const row = page.getByRole("link", { name: "A-201", exact: true });
  await row.click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Version history" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
  await page.goto("/en/projects/P-001/variations/VE-007");
  await page.getByRole("combobox", { name: "Preview role" }).selectOption("qs");
  await expect(
    page.getByRole("combobox", { name: "Add BOQ item" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record decision" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "3.2.14", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: /3.2.14/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Workbook version · WV-2/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Open in Excel" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Projects", exact: true })
    .getByRole("link", { name: "Variations", exact: true })
    .click();
  await page.getByRole("link", { name: "VE-007", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Preview role" })
    .selectOption("viewer");
  await expect(
    page.getByRole("combobox", { name: "Preview role" }),
  ).toHaveValue("viewer");
  await expect(
    page.getByRole("combobox", { name: "Add BOQ item" }),
  ).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record decision" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "See price forecast" }).first().click();
  await expect(page).toHaveURL(/materials\/rebar/);
  await expect(
    page.getByRole("heading", { name: "Price forecast", exact: true }),
  ).toBeVisible();
  await page.getByText("Show price data table", { exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "80% likely range" }),
  ).toBeVisible();
});

test("upload adds a new document, then a new version and automatic comparison", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/en/projects/P-001/documents");
  await page
    .getByRole("button", { name: "Upload documents", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/mock-files/drawings/A-201-rev-B.pdf");
  await page.getByLabel("Document number", { exact: true }).fill("DEMO-A201");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Upload journey floor plan");
  await page.getByLabel("Revision label", { exact: true }).fill("B");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(
    page.getByText("A-201-rev-B.pdf · File uploaded", { exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/mock-files/drawings/A-201-rev-C.pdf");
  await page.getByLabel("Document number", { exact: true }).fill("demo-a201");
  await expect(
    page.getByRole("status").filter({
      hasText:
        "This will be added as a new version of DEMO-A201 (current: Rev B)",
    }),
  ).toBeVisible();
  await page.getByLabel("Revision label", { exact: true }).fill("C");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Compare with Rev B", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search documents").fill("DEMO-A201");
  await page.getByRole("link", { name: "DEMO-A201", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Current", { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("dialog").getByText("Superseded", { exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Compare with Rev B", exact: true })
    .click();
  await expect(page.getByTestId("comparison-canvas")).toBeVisible({
    timeout: 25000,
  });
  await expect(
    page.getByRole("heading", { name: "Changes (4)", exact: true }),
  ).toBeVisible();
});
