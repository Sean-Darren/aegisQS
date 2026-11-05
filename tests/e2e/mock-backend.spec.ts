import { test, expect } from "@playwright/test";
test("browser mocks parse a real uploaded workbook and refresh Documents through WS", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/projects/P-001/documents");
  await expect(
    page.getByRole("link", { name: "A-201", exact: true }),
  ).toBeVisible();
  const workbook = await page.evaluate(async () => {
    const blob = await (
      await fetch("/mock-files/workbooks/boq-v2.xlsx")
    ).blob();
    const form = new FormData();
    form.set(
      "file",
      new File([blob], "uploaded-boq.xlsx", { type: blob.type }),
    );
    form.set("name", "Browser uploaded BOQ");
    form.set("kind", "boq");
    const response = await fetch("/api/v1/projects/P-001/workbooks", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { id: string; currentVersionId: string };
  });
  await page.getByLabel("Search documents").fill("Browser uploaded BOQ");
  await expect(
    page.getByText("Browser uploaded BOQ", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        page.evaluate(async (versionId) => {
          const version = await (
            await fetch(`/api/v1/workbook-versions/${versionId}`)
          ).json();
          return version.status;
        }, workbook.currentVersionId),
      { timeout: 15000 },
    )
    .toBe("checked");
  const checks = await page.evaluate(
    async (id) =>
      (await (
        await fetch(
          `/api/v1/workbook-versions/${id}/checks?rule=amount_mismatch`,
        )
      ).json()) as { rule: string }[],
    workbook.currentVersionId,
  );
  expect(checks).toHaveLength(1);
  await page.getByRole("link", { name: "Audit", exact: true }).click();
  await expect(
    page.getByText("Workbook checks completed", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
