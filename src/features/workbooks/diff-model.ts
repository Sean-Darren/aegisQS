import type { BoqItem, WorkbookDiff, VariationEvent } from "@/schemas";
export type DiffRow = WorkbookDiff["rows"][number];
export function amountDelta(row: DiffRow) {
  const amount = row.fields.find((f) => f.field === "amount");
  return (
    Math.round(
      (Number(amount?.after ?? 0) - Number(amount?.before ?? 0)) * 100,
    ) / 100
  );
}
export function rowSection(row: DiffRow, base: BoqItem[], target: BoqItem[]) {
  return (
    (row.kind === "removed" ? base : target).find(
      (i) => i.sheet === row.sheet && i.row === row.row,
    )?.section ?? ""
  );
}
export function linkedVariations(row: DiffRow, variations: VariationEvent[]) {
  return variations.filter((v) =>
    v.costLines.some(
      (l) =>
        l.boqItemRef === row.itemRef ||
        row.description === l.description ||
        row.description === `${l.description} — ${v.ref}`,
    ),
  );
}
export async function allVersionItems(
  getPage: (
    cursor?: string,
  ) => Promise<{ data: BoqItem[]; nextCursor?: string }>,
) {
  const items: BoqItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await getPage(cursor);
    items.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export function rateUnit(
  row: DiffRow,
  side: "before" | "after",
  fallback?: string,
) {
  const change = row.fields.find((f) => f.field === "unit");
  const value = change ? change[side] : fallback;
  return typeof value === "string" && value.trim() ? value : undefined;
}
