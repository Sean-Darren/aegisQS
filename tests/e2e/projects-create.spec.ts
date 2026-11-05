import { test, expect } from "@playwright/test";

test("QS can create, open, and delete a project", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/en/login");
  await page.getByRole("link", { name: "Continue to projects" }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();

  const addButton = page.getByRole("button", { name: "Add project" });
  await expect(addButton).toBeVisible();
  await addButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Add project", exact: true }),
  ).toBeVisible();

  await dialog.getByLabel("Project name").fill("Tsuen Wan Data Centre");
  await dialog.getByLabel("Project code").fill("P-TWDC");
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/en\/projects\/P-[^/]+\/overview$/);
  await expect(
    page.getByRole("heading", {
      name: "Tsuen Wan Data Centre",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Projects" })
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tsuen Wan Data Centre", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("P-TWDC", { exact: true }).first(),
  ).toBeVisible();

  const projectCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Tsuen Wan Data Centre",
      exact: true,
    }),
  });
  await projectCard
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  const deleteDialog = page.getByRole("dialog");
  await expect(
    deleteDialog.getByRole("heading", {
      name: "Delete project",
      exact: true,
    }),
  ).toBeVisible();
  await deleteDialog
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Tsuen Wan Data Centre",
      exact: true,
    }),
  ).not.toBeVisible();

  expect(errors).toEqual([]);
});
