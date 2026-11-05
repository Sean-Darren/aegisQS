import type { DrawingComparison, DrawingChange } from "@/schemas";
import regions from "@/mocks/fixtures/drawing-regions.json";
import files from "@/mocks/fixtures/drawing-files.json";
import type { DomainContext } from "./context";
export function createStartComparison(ctx: DomainContext) {
  const { state, audit, nextId, now, emit } = ctx;
  return function startComparison(
    projectId: string,
    documentId: string,
    baseVersionId: string,
    targetVersionId: string,
  ) {
    const comparison: DrawingComparison = {
      id: nextId("CMP"),
      projectId,
      documentId,
      baseVersionId,
      targetVersionId,
      status: "queued",
      progressPct: 0,
      alignment: {
        dx: 0,
        dy: 0,
        scale: 1,
        rotationDeg: 0,
        method: "auto",
        quality: 0.96,
      },
      pageCount: 1,
      changeCounts: {
        added: 0,
        removed: 0,
        modified: 0,
        dimension: 0,
        annotation: 0,
      },
      modelVersion: "mock-drawing-1.0",
      createdAt: now(),
    };
    state.comparisons.push(comparison);
    audit(
      "comparison.started",
      "comparison",
      comparison.id,
      "Revision comparison queued",
    );
    emit(projectId, {
      type: "comparison.progress",
      comparisonId: comparison.id,
      status: "queued",
      progressPct: 0,
    });
    scheduleComparison(ctx, comparison);
    return comparison;
  };
}
export function scheduleComparison(
  ctx: DomainContext,
  comparison: DrawingComparison,
) {
  const { state, audit, nextId, now, emit, schedule } = ctx;
  const actor = ctx.currentUser();
  const { projectId, baseVersionId, targetVersionId } = comparison;
  for (const [ms, status, pct] of [
    [1500, "aligning", 20],
    [4500, "detecting", 60],
    [10000, "succeeded", 100],
  ] as const)
    schedule(() => {
      comparison.status = status;
      comparison.progressPct = pct;
      if (status === "succeeded") {
        const base = state.versions.find((v) => v.id === baseVersionId)!,
          target = state.versions.find((v) => v.id === targetVersionId)!;
        const templates =
          base.sha256 === files["A-201-B"].sha256 &&
          target.sha256 === files["A-201-C"].sha256
            ? regions.a201
            : base.sha256 === files["S-110-P1"].sha256 &&
                target.sha256 === files["S-110-P2"].sha256
              ? regions.s110
              : [];
        if (!templates.length) {
          comparison.status = "failed";
          comparison.error =
            "No deterministic detection fixture exists for this pair. Use the generated A-201 B → C or S-110 P1 → P2 files.";
          comparison.finishedAt = now();
          audit(
            "comparison.failed",
            "comparison",
            comparison.id,
            "No mock detection fixture for this revision pair",
            undefined,
            actor,
          );
          emit(projectId, {
            type: "comparison.completed",
            comparisonId: comparison.id,
            status: "failed",
            changeCount: 0,
          });
          return;
        }
        for (const [i, template] of templates.entries()) {
          const change: DrawingChange = {
            ...template,
            kind: template.kind as DrawingChange["kind"],
            id: nextId("CH"),
            comparisonId: comparison.id,
            number: i + 1,
            page: 1,
            confidence: i === 3 ? 0.58 : 0.94,
            status: "new",
          };
          state.changes.push(change);
          comparison.changeCounts[change.kind]++;
          state.links.push(
            {
              from: { type: "change", id: change.id },
              to: { type: "document_version", id: baseVersionId },
            },
            {
              from: { type: "change", id: change.id },
              to: { type: "document_version", id: targetVersionId },
            },
          );
        }
        comparison.finishedAt = now();
        audit(
          "comparison.completed",
          "comparison",
          comparison.id,
          `Comparison ready — ${templates.length} changes found`,
          undefined,
          actor,
        );
        emit(projectId, {
          type: "comparison.completed",
          comparisonId: comparison.id,
          status: "succeeded",
          changeCount: templates.length,
        });
      } else
        emit(projectId, {
          type: "comparison.progress",
          comparisonId: comparison.id,
          status,
          progressPct: pct,
        });
    }, ms);
}
