// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import {
  comparisons,
  changes,
  documents,
  versions,
} from "@/mocks/fixtures/data";
import { users } from "@/mocks/fixtures/users";
import { queryKeys } from "@/lib/api";
import { ComparisonPage } from "@/features/drawings/components/comparison-page";
import type { ReactNode } from "react";
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="canvas" />,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ data: users[0] }),
}));
afterEach(cleanup);
test("J and K select the next and previous change from the viewer", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const comparison = comparisons.find((c) => c.id === "CMP-A201")!;
  client.setQueryData(queryKeys.comparison(comparison.id), comparison);
  client.setQueryData(
    queryKeys.changes(comparison.id),
    changes.filter((c) => c.comparisonId === comparison.id),
  );
  client.setQueryData(
    queryKeys.document(comparison.documentId),
    documents.find((d) => d.id === comparison.documentId),
  );
  client.setQueryData(
    queryKeys.versions(comparison.documentId),
    versions.filter((v) => v.documentId === comparison.documentId),
  );
  client.setQueryData(
    ["document-file", comparison.baseVersionId],
    new Blob(["pdf"]),
  );
  client.setQueryData(
    ["document-file", comparison.targetVersionId],
    new Blob(["pdf"]),
  );
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ComparisonPage comparisonId={comparison.id} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  const viewer = screen.getByRole("region", { name: /arrow keys pan/i });
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
    "Slab opening enlarged",
  );
  fireEvent.keyDown(viewer, { key: "j" });
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
    "Additional beam added",
  );
  fireEvent.keyDown(viewer, { key: "k" });
  expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
    "Slab opening enlarged",
  );
});
