import { test, expect } from "@playwright/test";

test("saved BIM artifact appears and extracts materials into procurement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      errors.push(message.text());
  });

  await page.goto("/en/projects/P-001/procurement");

  const artifactSelect = page.getByRole("combobox", {
    name: "Saved BIM analysis artifact",
  });
  await expect(artifactSelect).toBeVisible();
  await artifactSelect.click();

  await expect(
    page.getByRole("option", { name: /BIM-001/ }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: /BIM-001 · BIM analysis · sample-model\.ifc/ })
    .click();

  await page
    .getByRole("button", { name: "Extract materials from project" })
    .click();

  await expect(
    page.getByText("2 material need(s) extracted from the saved artifact"),
  ).toBeVisible();

  const materialsTable = page.getByRole("table").first();
  await expect(
    materialsTable.getByRole("link", {
      name: "High-tensile steel rebar",
      exact: true,
    }).first(),
  ).toBeVisible();
  await expect(
    materialsTable.getByRole("link", {
      name: "Ready-mixed concrete C35",
      exact: true,
    }).first(),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
