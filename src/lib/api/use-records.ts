"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { queryKeys, resources } from "@/lib/api";
export function useProjectDocuments(projectId: string) {
  const documents = useQuery({
    queryKey: queryKeys.documents(projectId),
    queryFn: () => resources.documents(projectId),
    enabled: !!projectId,
  });
  const versions = useQueries({
    queries: (documents.data ?? []).map((d) => ({
      queryKey: queryKeys.versions(d.id),
      queryFn: () => resources.versions(d.id),
      staleTime: 30000,
    })),
  });
  return {
    documents,
    versions,
    allVersions: versions.flatMap((q) => q.data ?? []),
  };
}
export function useDocument(documentId: string) {
  const document = useQuery({
    queryKey: queryKeys.document(documentId),
    queryFn: () => resources.document(documentId),
    enabled: !!documentId,
  });
  const versions = useQuery({
    queryKey: queryKeys.versions(documentId),
    queryFn: () => resources.versions(documentId),
    enabled: !!documentId,
  });
  return { document, versions };
}
export function useFile(versionId: string) {
  return useQuery({
    queryKey: ["document-file", versionId],
    queryFn: () => resources.documentFile(versionId),
    enabled: !!versionId,
    staleTime: Infinity,
  });
}
