import type { ColumnMapping, SheetPreview } from "@/schemas";
export const mappingFields = [
  "itemRef",
  "description",
  "unit",
  "quantity",
  "rate",
  "amount",
  "section",
] as const;
export function mappingValid(mapping: ColumnMapping) {
  const cols = mappingFields.slice(0, 6).map((k) => mapping.columns[k]);
  return (
    !!mapping.sheet &&
    Number.isInteger(mapping.headerRow) &&
    mapping.headerRow > 0 &&
    cols.every((c) => !!c && /^[A-Z]{1,3}$/.test(c)) &&
    new Set(cols).size === cols.length
  );
}
export function suggestColumns(rows: SheetPreview["rows"], headerRow: number) {
  const cells = rows.find((r) => r.row === headerRow)?.cells ?? [];
  const patterns = {
    itemRef: /item.*ref|item.*no|編號/i,
    description: /description|描述/i,
    unit: /^unit$|單位/i,
    quantity: /quantity|qty|數量/i,
    rate: /rate|單價/i,
    amount: /amount|金額/i,
    section: /section|trade|分部/i,
  };
  return Object.fromEntries(
    mappingFields.map((k) => [
      k,
      cells.find((c) => patterns[k].test(String(c.value)))?.column ?? "",
    ]),
  ) as ColumnMapping["columns"];
}
