import { test, expect } from "vitest";
import { prepareDemoStory, resetDemoData } from "@/mocks/demo";
import { state } from "@/mocks/store";
test("story start rewinds safely; reset restores finished fixtures", () => {
  prepareDemoStory();
  expect(state.documents.find((d) => d.id === "D-A201")?.currentVersionId).toBe(
    "D-A201-v2",
  );
  expect(state.workbooks[0].currentVersionId).toBe("WV-1");
  expect(state.variations.some((v) => v.ref === "VE-007")).toBe(false);
  resetDemoData();
  expect(state.documents.find((d) => d.id === "D-A201")?.currentVersionId).toBe(
    "D-A201-v3",
  );
  expect(state.workbooks[0].currentVersionId).toBe("WV-2");
  expect(
    state.variations.find((v) => v.ref === "VE-007")?.indicativeCost?.total,
  ).toBe(186400);
});
