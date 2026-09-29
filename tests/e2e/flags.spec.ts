import { expect, test } from "@playwright/test";

test("flag evidence, decision, inbox counts, and focus return work together", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/projects/P-001/flags");
  await expect(page.getByRole("heading", { name: "Flag inbox" })).toBeVisible();
  const summary = page.getByRole("region", { name: "Flag summary" });
  const blocking = summary
    .getByText("Decisions before sign-off")
    .locator("..")
    .locator("p")
    .last();
  const before = Number(await blocking.textContent());
  const trigger = page.locator('[data-evidence-trigger="F-001"]');
  await trigger.click();
  await expect(page).toHaveURL(/evidence=F-001/);
  const drawer = page.getByRole("dialog", { name: "Flag evidence" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("−3.0σ vs ±2.0σ threshold")).toBeVisible();
  await expect(drawer.locator("canvas")).toBeVisible();
  await expect(drawer.getByTestId("evidence-bbox")).toBeVisible();
  await drawer
    .getByRole("textbox", { name: "Reason" })
    .fill("Reviewed the source and benchmark.");
  await drawer.getByRole("button", { name: "Record decision" }).click();
  await expect(drawer.getByText("Final decision: Accept")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(blocking).toHaveText(String(before - 1));
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});
