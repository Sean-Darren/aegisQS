import { expect, test } from "@playwright/test";

test("scope register selects source evidence and chart shows threshold", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/projects/P-001/tender/scope");
  await expect(
    page.getByRole("heading", { name: "Scope review" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The dashed line marks the 15% provisional sum threshold. Review bars above this line.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "F-02", exact: true }).click();
  await expect(
    page.getByText("Waterproofing detail remains vague.").last(),
  ).toBeVisible();
  await expect(
    page.locator(".react-pdf__Page__textContent mark.scope-finding-highlight"),
  ).toContainText("Waterproofing detail remains vague.");
  await page
    .getByRole("table")
    .first()
    .getByRole("button", { name: "Open F-002" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).not.toBeVisible();
  await page.getByLabel("Filter by status").selectOption("missing");
  await expect(
    page.getByRole("button", { name: "F-03", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "F-02", exact: true }),
  ).toHaveCount(0);
  await page.goto("/en/projects/P-001/pre-tender/scope-gaps");
  await expect(
    page.getByRole("heading", { name: "Scope review" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
