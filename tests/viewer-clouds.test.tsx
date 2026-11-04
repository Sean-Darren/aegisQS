// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { RevisionClouds } from "@/components/viewer/revision-clouds";
import { changes, comparisons } from "@/mocks/fixtures/data";
afterEach(cleanup);
test.each([
  [0.25, "M 128 115 A"],
  [1, "M 152 139 A"],
  [4, "M 158 145 A"],
])("cloud bboxes and selection remain correct at zoom %s", (zoom, prefix) => {
  const onSelect = vi.fn();
  const comparison = comparisons[0];
  const { container } = render(
    <RevisionClouds
      changes={changes.filter((c) => c.comparisonId === comparison.id)}
      width={1000}
      height={700}
      zoom={zoom as number}
      alignment={{
        ...comparison.alignment,
        dx: 12,
        dy: -5,
        scale: 1.1,
        rotationDeg: 2,
      }}
      onSelect={onSelect}
    />,
  );
  expect(container.querySelector("svg > g")).toHaveAttribute(
    "transform",
    "translate(12 -5) scale(1.1) rotate(2 500 350)",
  );
  expect(container.querySelectorAll("[data-change-cloud]")).toHaveLength(4);
  const first = container.querySelector('[data-change-cloud="CH-A201-1"]')!;
  expect(
    first
      .querySelector("path")!
      .getAttribute("d")!
      .startsWith(prefix as string),
  ).toBe(true);
  fireEvent.click(first);
  expect(onSelect).toHaveBeenCalledWith("CH-A201-1");
});
