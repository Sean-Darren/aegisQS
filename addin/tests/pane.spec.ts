import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
const office = `history.pushState=null;history.replaceState=null;window.__selections=[];window.Office={onReady:cb=>cb({host:'Excel',platform:'OfficeOnline'}),EventType:{DialogMessageReceived:'message',DialogEventReceived:'closed'},context:{platform:'OfficeOnline',ui:{displayDialogAsync:(url,options,cb)=>{const handlers={};window.__dialogHandlers=handlers;const popup=window.open(url);cb({status:'succeeded',value:{close:()=>setTimeout(()=>popup.close(),0),addEventHandler:(name,fn)=>handlers[name]=fn}});},messageParent:message=>window.opener.__dialogHandlers.message({message,origin:location.origin})}}};window.Excel={run:async cb=>cb({workbook:{worksheets:{getItem:sheet=>({activate(){},getRange:cell=>Object.freeze({select:()=>window.__selections.push({sheet,cell})})})}},sync:async()=>{}})};`;
test("simulated Office host signs in with cookie, uploads a version, selects a check and warns about an older copy", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 780 });
  await context.route(
    "https://appsforoffice.microsoft.com/lib/1/hosted/office.js",
    (route) =>
      route.fulfill({ contentType: "application/javascript", body: office }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const popup = await popupPromise;

  await popup
    .getByRole("button", { name: "Finish sign in", exact: true })
    .click();
  await expect(page.getByText("Senior QS", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption("P-001");
  await page
    .getByRole("combobox", { name: "Smart QS workbook", exact: true })
    .selectOption("WB-001");
  await page
    .getByRole("spinbutton", { name: /Open file version number/ })
    .fill("2");
  await page
    .getByRole("button", { name: "Check this workbook", exact: true })
    .click();
  await page.getByRole("button", { name: /error · BOQ!F40/ }).click();
  expect(
    await page.evaluate(() => Reflect.get(window, "__selections")),
  ).toEqual([{ sheet: "BOQ", cell: "F40" }]);
  await page
    .getByRole("spinbutton", { name: /Open file version number/ })
    .fill("1");
  await page.getByRole("button", { name: "Pull latest", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "older than current version 2",
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    new Uint8Array(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../public/mock-files/workbooks/boq-v2.xlsx",
        ),
      ),
    ).buffer,
  );
  workbook.worksheets[0].getCell("B2").value =
    "Explicitly downloaded test copy";
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  await page.locator("input[type=file]").setInputFiles({
    name: "user-copy.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });
  await page
    .getByRole("checkbox", {
      name: "I confirm this downloaded copy matches the open workbook.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Save version to Smart QS", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Version 3 saved", {
    timeout: 20000,
  });
  await expect(
    page.getByRole("spinbutton", { name: /Open file version number/ }),
  ).toHaveValue("3");
  await expect
    .poll(
      async () => {
        await page
          .getByRole("button", { name: "Check this workbook", exact: true })
          .click();
        return page.locator(".check").count();
      },
      { timeout: 15000 },
    )
    .toBe(4);
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("zh-HK");
  await expect(
    page.getByRole("heading", { name: "Excel 內的 Smart QS", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "__selections")),
  ).toHaveLength(1);
});
