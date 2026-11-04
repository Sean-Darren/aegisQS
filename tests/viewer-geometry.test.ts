import { expect, test } from "vitest";
import {
  bboxPixels,
  nextChangeIndex,
  revisionCloudPath,
} from "@/components/viewer/geometry";
test("bbox positions remain normalized under 25–400% shared transforms", () => {
  for (const scale of [0.25, 1, 4])
    expect(
      bboxPixels({ x: 0.2, y: 0.3, w: 0.1, h: 0.2 }, 1000, 700, {
        x: 40,
        y: -20,
        scale,
      }),
    ).toEqual({
      x: 200 * scale + 40,
      y: 210 * scale - 20,
      w: 100 * scale,
      h: 140 * scale,
    });
  expect(revisionCloudPath(10, 20, 100, 50)).toMatch(/^M 10 20 A/);
});
test("J/K wrap through the filtered change list", () => {
  expect(nextChangeIndex(0, "k", 4)).toBe(3);
  expect(nextChangeIndex(3, "j", 4)).toBe(0);
  expect(nextChangeIndex(0, "j", 0)).toBe(-1);
  expect(nextChangeIndex(1, "ArrowRight", 4)).toBe(1);
});
