import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  WsEvent,
  DrawingComparison,
  DrawingRegisterEntry,
  WorkbookVersion,
} from "@/schemas";
export function refreshProject(client: QueryClient, projectId: string) {
  void client.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  void client.invalidateQueries({
    predicate: (q) => {
      const data = q.state.data;
      return (
        !!data &&
        typeof data === "object" &&
        "projectId" in data &&
        data.projectId === projectId
      );
    },
  });
}
export function applyProjectEvent(
  client: QueryClient,
  projectId: string,
  event: WsEvent,
) {
  if (
    event.type === "comparison.progress" ||
    event.type === "comparison.completed"
  ) {
    const update = (previous: DrawingComparison | undefined) =>
      previous
        ? {
            ...previous,
            status: event.status,
            progressPct:
              event.type === "comparison.progress" ? event.progressPct : 100,
          }
        : previous;
    client.setQueryData<DrawingComparison>(
      queryKeys.comparison(event.comparisonId),
      update,
    );
    client.setQueryData<DrawingRegisterEntry[]>(
      queryKeys.drawings(projectId),
      (previous) =>
        previous?.map((entry) =>
          entry.latestComparison?.id === event.comparisonId
            ? { ...entry, latestComparison: update(entry.latestComparison) }
            : entry,
        ),
    );
    if (event.type === "comparison.completed") {
      void client.invalidateQueries({
        queryKey: queryKeys.comparison(event.comparisonId),
      });
      refreshProject(client, projectId);
    }
  } else if (event.type === "document.version_added") {
    void client.invalidateQueries({
      queryKey: queryKeys.document(event.documentId),
    });
    refreshProject(client, projectId);
  } else {
    client.setQueryData<WorkbookVersion>(
      queryKeys.workbookVersion(event.versionId),
      (previous) =>
        previous
          ? { ...previous, status: "checked", checkSummary: event.checkSummary }
          : previous,
    );
    void client.invalidateQueries({
      queryKey: queryKeys.workbookVersion(event.versionId),
    });
    void client.invalidateQueries({
      queryKey: queryKeys.workbook(event.workbookId),
    });
    refreshProject(client, projectId);
  }
}
