import { resetStore, state } from "./store";
/** Explicit development-only starting position for the connected story. */
export function prepareDemoStory() {
  resetStore();
  state.versions = state.versions.filter(
    (v) => v.id !== "D-A201-v3" && v.id !== "D-BOQ-v2",
  );
  for (const [id, version] of [
    ["D-A201", "D-A201-v2"],
    ["D-BOQ", "D-BOQ-v1"],
  ]) {
    const document = state.documents.find((d) => d.id === id);
    if (document) {
      document.currentVersionId = version;
      document.versionCount = state.versions.filter(
        (v) => v.documentId === id,
      ).length;
    }
    const current = state.versions.find((v) => v.id === version);
    if (current) current.status = "current";
  }
  state.comparisons = state.comparisons.filter(
    (c) => c.documentId !== "D-A201",
  );
  state.changes = state.changes.filter((c) => c.comparisonId !== "CMP-A201");
  state.variations = state.variations.filter((v) => v.id !== "VE-007");
  state.workbooks.find((w) => w.id === "WB-001")!.currentVersionId = "WV-1";
  state.workbookVersions = state.workbookVersions.filter(
    (v) => v.id !== "WV-2",
  );
  state.items = state.items.filter((i) => i.workbookVersionId !== "WV-2");
  state.checks = state.checks.filter((c) => c.versionId !== "WV-2");
  state.procurement = [];
  state.materialNeeds = state.materialNeeds.filter(
    (n) => n.source !== "variation",
  );
  state.auditEvents = [];
  state.links = state.links.filter(
    (l) =>
      ![l.from.id, l.to.id].some(
        (id) =>
          id === "VE-007" ||
          id === "WV-2" ||
          id === "D-A201-v3" ||
          id.startsWith("CH-A201"),
      ),
  );
}
export { resetStore as resetDemoData };
