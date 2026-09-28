import { expect, test } from "@playwright/test";
import en from "../../src/messages/en.json";
import zh from "../../src/messages/zh-HK.json";
test("home defaults to English, renders both locales, and starts browser mocks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(
    page.getByRole("heading", { name: en.Home.title }),
  ).toBeVisible();
  await expect(page.getByText(en.Home.description)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const currentUser = await page.evaluate(async () => {
    const response = await fetch("/api/v1/me");
    return { status: response.status, body: await response.json() };
  });
  expect(currentUser.status).toBe(200);
  expect(currentUser.body.role).toBe("senior_qs");
  await page.goto("/zh-HK");
  await expect(
    page.locator("main p").filter({ hasText: zh.Home.description }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-HK");
  expect(errors).toEqual([]);
});
