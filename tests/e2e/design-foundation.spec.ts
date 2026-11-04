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

test("sidebar uses a 240px panel and 64px rail with accessible links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/en/projects/P-001/documents");
  const nav = page.getByRole("navigation", { name: "Projects", exact: true });
  await expect(nav).toBeVisible();
  expect((await nav.boundingBox())!.width).toBe(240);
  await expect(
    nav.getByRole("link", { name: "Documents", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "/tmp/smartqs-foundation-wide.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect((await nav.boundingBox())!.width).toBe(64);
  await nav.getByRole("link", { name: "Drawings", exact: true }).focus();
  await expect(page.getByRole("tooltip")).toHaveText("Drawings");
  await page.screenshot({ path: "/tmp/smartqs-foundation-rail.png" });
  await nav.getByRole("link", { name: "Drawings", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/drawings$/);
});

test("new roles preserve read access and viewer exposes no mutation actions", async ({
  page,
}) => {
  await page.goto("/en/projects");
  for (const role of ["senior_qs", "qs", "viewer"]) {
    await page
      .getByRole("combobox", { name: "Preview role" })
      .selectOption(role);
    await expect(
      page.getByRole("combobox", { name: "Preview role" }),
    ).toHaveValue(role);
    await expect(
      page.getByRole("heading", { name: "Central Market Rehab Phase 2" }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Open project" }).click();
  await expect(
    page.getByRole("navigation", { name: "Projects" }),
  ).toBeVisible();
  for (const route of [
    "overview",
    "documents",
    "drawings",
    "variations",
    "workbooks",
    "procurement",
    "audit",
  ]) {
    await page
      .getByRole("navigation", { name: "Projects" })
      .getByRole("link", {
        name: route[0].toUpperCase() + route.slice(1),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${route}$`));
    await expect(
      page.getByRole("combobox", { name: "Preview role" }),
    ).toHaveValue("viewer");
    await expect(
      page.getByRole("button", {
        name: /upload|confirm variation|reject|set as current|raise potential variation/i,
      }),
    ).toHaveCount(0);
  }
  await page.goto("/zh-HK/projects");
  await expect(
    page.getByRole("heading", { name: "項目", exact: true }),
  ).toBeVisible();
});
