import { expect, test } from "@playwright/test";

test("Karla tabular numerals hold equal width", async ({ page }) => {
  await page.goto("/en");
  const widths = await page.evaluate(async () => {
    await document.fonts.ready;
    const container = document.createElement("div");
    container.className = "num";
    container.style.cssText =
      "position:absolute;font-size:32px;font-weight:700;white-space:nowrap";
    const first = document.createElement("span");
    const second = document.createElement("span");
    first.textContent = "1111.11";
    second.textContent = "0000.00";
    first.style.display = second.style.display = "block";
    container.append(first, second);
    document.body.append(container);
    const result = [
      first.getBoundingClientRect().width,
      second.getBoundingClientRect().width,
    ];
    container.remove();
    return result;
  });
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(0.5);
});

test("portfolio is translated and owner role hides project navigation", async ({
  page,
}) => {
  await page.goto("/en/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Central Market Rehab Phase 2" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Preview role" })
    .selectOption("owner_viewer");
  await expect(
    page.getByText("Signed reports are available through a shared link."),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Projects" })).toHaveCount(
    0,
  );
  await page.goto("/zh-HK/projects");
  await expect(page.getByRole("heading", { name: "項目" })).toBeVisible();
});

test("evidence drawer survives a direct link and Escape clears URL state", async ({
  page,
}) => {
  await page.goto("/en/projects/P-001/overview?evidence=F-001");
  await expect(
    page.getByRole("dialog", { name: "Flag evidence" }),
  ).toBeVisible();
  await expect(page.getByText("Excerpt", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Flag evidence" })).toHaveCount(
    0,
  );
  await expect(page).not.toHaveURL(/evidence=/);
});
