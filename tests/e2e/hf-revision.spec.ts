import { test, expect } from "@playwright/test";

test("HF CLIP pipeline generates real material-difference cards for two distinct images", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/en/projects/P-001/drawings");

  const drawingCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "A-201 · Level 2 floor plan",
      exact: true,
    }),
  });
  await expect(drawingCard).toBeVisible();

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
    await expect(dialog.getByText(/File uploaded|檔案已上載/)).toBeVisible({
      timeout: 20000,
    });
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

  // Base and target dropdowns default to the two most recent revisions.
  await drawingCard
    .getByRole("button", { name: "Compare revisions", exact: true })
    .click();

  await expect(page.getByTestId("comparison-canvas")).toBeVisible({
    timeout: 25000,
  });

  // The Python CLIP bridge takes ~60-90s (HF hub retries + inference).
  // The comparison eventually leaves the "detecting" stage and shows cards.
  const changesHeading = page.getByRole("heading", { name: /Changes \(\d+\)/ });
  await expect(changesHeading).toBeVisible({ timeout: 150000 });

  const changeCards = page.locator("ol > li");
  await expect(changeCards.first()).toBeVisible({ timeout: 150000 });

  // Real HF output includes material descriptions; the generic raster
  // fallback says "Visual content". Ensure we are not on the fallback path.
  const firstCardText = await changeCards.first().innerText();
  expect(firstCardText.toLowerCase()).not.toContain("visual content");

  // Confirm at least one change is visible and no page errors occurred.
  await expect(changeCards.first()).toContainText(/added|removed|modified/i);
  expect(errors).toEqual([]);
});
