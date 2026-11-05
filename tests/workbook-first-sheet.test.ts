import { expect, test } from "vitest";
import ExcelJS from "exceljs";
import { parseWorkbook } from "@/mocks/workbook-engine";
test("first upload without a BOQ-named sheet can reach mapping", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Cost plan");
  sheet.addRow([
    "Item ref",
    "Description",
    "Unit",
    "Quantity",
    "Rate",
    "Amount",
  ]);
  sheet.addRow(["CP-1", "Concrete", "m³", 2, 100, 200]);
  const bytes = new Uint8Array(await book.xlsx.writeBuffer()).buffer;
  const parsed = await parseWorkbook(bytes, "NEW");
  expect(parsed.sheetNames).toEqual(["Cost plan"]);
  expect(parsed.items[0]).toMatchObject({
    itemRef: "CP-1",
    quantity: 2,
    rate: 100,
    amount: 200,
  });
});
