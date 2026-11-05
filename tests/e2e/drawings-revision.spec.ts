import { test, expect } from "@playwright/test";

test("drawings register exposes an in-place Add revision action", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/drawings");

  const drawingCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "A-201 · Level 2 floor plan",
      exact: true,
    }),
  });
  await expect(drawingCard).toBeVisible();

  const addRevision = drawingCard.getByRole("button", {
    name: "Add revision",
    exact: true,
  });
  await expect(addRevision).toBeVisible();
  await addRevision.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Add revision for A-201",
      exact: true,
    }),
  ).toBeVisible();

  await dialog
    .locator('input[type="file"]')
    .setInputFiles("public/mock-files/drawings/S-110-rev-P1.pdf");

  await expect(
    dialog.getByLabel("Revision label", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Revision label", { exact: true })
    .fill("D");
  await dialog
    .getByRole("button", { name: "Upload file", exact: true })
    .click();
  await expect(
    dialog.getByText(/File uploaded|檔案已上載/),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    drawingCard.locator("span").filter({ hasText: "Rev D" }).first(),
  ).toBeVisible();
});

test("custom uploaded PDF revision pairs complete without inventing hardcoded changes when HF worker is absent", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/en/projects/P-001/drawings");

  const drawingCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "A-201 · Level 2 floor plan",
      exact: true,
    }),
  });
  await drawingCard
    .getByRole("button", { name: "Add revision", exact: true })
    .click();

  const dialog = page.getByRole("dialog");
  await dialog
    .locator('input[type="file"]')
    .setInputFiles("public/mock-files/drawings/S-110-rev-P1.pdf");
  await dialog.getByLabel("Revision label", { exact: true }).fill("D");
  await dialog
    .getByRole("button", { name: "Upload file", exact: true })
    .click();
  await expect(dialog.getByText(/File uploaded|檔案已上載/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await drawingCard
    .getByRole("button", { name: "Compare revisions", exact: true })
    .click();

  await expect(page.getByTestId("comparison-canvas")).toBeVisible({
    timeout: 25000,
  });
  await page.getByRole("radio", { name: "Overlay", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Changes \(0\)/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Select change/ }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("raster image revisions are compared from their actual pixel differences", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/en/projects/P-001/drawings");

  const drawingCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "A-201 · Level 2 floor plan",
      exact: true,
    }),
  });

  async function uploadRevision(filePath: string, label: string) {
    await drawingCard
      .getByRole("button", { name: "Add revision", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(filePath);
    await dialog.getByLabel("Revision label", { exact: true }).fill(label);
    await dialog
      .getByRole("button", { name: "Upload file", exact: true })
      .click();
    await expect(dialog.getByText(/File uploaded|檔案已上載/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }

  await uploadRevision(
    "/Users/glennjeffersonchandra/AegisQS/software/Images/images.jpeg",
    "D",
  );
  await uploadRevision(
    "/Users/glennjeffersonchandra/AegisQS/software/Images/images (1).jpeg",
    "E",
  );

  await drawingCard
    .getByRole("button", { name: "Compare revisions", exact: true })
    .click();

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
  await expect(
    page.getByText(
      "The drawing could not be rendered. Check the file in Documents.",
    ),
  ).toHaveCount(0);
  await expect(page.getByText(/Visual content/).first()).toBeVisible({
    timeout: 20000,
  });
  expect(errors).toEqual([]);
});
