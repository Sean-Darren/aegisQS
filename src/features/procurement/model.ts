import type {
  Material,
  ProcurementAdvice,
  ProjectMaterialNeed,
} from "@/schemas";
import { formatPeriod, type FormatLocale } from "@/lib/format";
export function adviceWindow(advice: ProcurementAdvice, locale: FormatLocale) {
  if (!advice.window) return undefined;
  const { from, to } = advice.window;
  if (from === to) return formatPeriod(from, locale);
  if (locale === "en" && from.slice(0, 4) === to.slice(0, 4))
    return `${formatPeriod(from, locale).split(" ")[0]}–${formatPeriod(to, locale)}`;
  return `${formatPeriod(from, locale)} – ${formatPeriod(to, locale)}`;
}
export function newestAdvice(advice: ProcurementAdvice[], materialId: string) {
  return advice
    .filter((a) => a.materialId === materialId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
export function exposureRows(
  needs: ProjectMaterialNeed[],
  materials: Material[],
) {
  const rows = new Map<
    string,
    { material: Material; p10: number; p50: number; p90: number }
  >();
  for (const need of needs) {
    const material = materials.find((m) => m.id === need.materialId);
    if (!material) continue;
    const row = rows.get(material.id) ?? { material, p10: 0, p50: 0, p90: 0 };
    row.p10 += need.exposureHKD.p10;
    row.p50 += need.exposureHKD.p50;
    row.p90 += need.exposureHKD.p90;
    rows.set(material.id, row);
  }
  return [...rows.values()].sort((a, b) => b.p90 - a.p90);
}
