import type { BBox } from "@/schemas";
export type ViewTransform = { x: number; y: number; scale: number };
export function bboxPixels(
  box: BBox,
  width: number,
  height: number,
  transform: ViewTransform = { x: 0, y: 0, scale: 1 },
) {
  return {
    x: box.x * width * transform.scale + transform.x,
    y: box.y * height * transform.scale + transform.y,
    w: box.w * width * transform.scale,
    h: box.h * height * transform.scale,
  };
}
export function nextChangeIndex(current: number, key: string, count: number) {
  if (!count) return -1;
  return key.toLowerCase() === "j"
    ? (current + 1 + count) % count
    : key.toLowerCase() === "k"
      ? (current - 1 + count) % count
      : current;
}
export function revisionCloudPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r = 10,
) {
  const pts: Array<[number, number]> = [];
  const along = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / (r * 2)));
    for (let i = 0; i < n; i++)
      pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  along(x, y, x + w, y);
  along(x + w, y, x + w, y + h);
  along(x + w, y + h, x, y + h);
  along(x, y + h, x, y);
  pts.push(pts[0]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1],
      [cx, cy] = pts[i];
    const rr = Math.hypot(cx - px, cy - py) / 2;
    d += ` A ${rr} ${rr} 0 0 1 ${cx} ${cy}`;
  }
  return d + " Z";
}
