// @vitest-environment jsdom
import { expect, test, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { UploadForm } from "@/features/documents/components/upload-form";
import { ConflictResolution } from "@/features/documents/components/conflict-resolution";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { documents, versions } from "@/mocks/fixtures/data";
import { users } from "@/mocks/fixtures/users";
import { resources } from "@/lib/api";
import type { ReactNode } from "react";
vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/ui/DecisionForm")
  >("@/components/ui/DecisionForm");
  const button = await vi.importActual<typeof import("@/components/ui/button")>(
    "@/components/ui/button",
  );
  return {
    ...actual,
    ...button,
    ErrorState: ({ message }: { message: string }) => (
      <p role="alert">{message}</p>
    ),
    useToast: () => vi.fn(),
  };
});
function mount(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
afterEach(cleanup);
test("upload form distinguishes existing document numbers and validates a new revision", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  mount(
    <UploadForm
      file={new File(["pdf"], "drawing.pdf")}
      documents={documents}
      versions={versions}
      pending={false}
      onSubmit={submit}
    />,
  );
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.change(screen.getByLabelText("Document number"), {
    target: { value: "A-201" },
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "This will be added as a new version of A-201 (current: Rev C)",
  );
  fireEvent.change(screen.getByLabelText("Revision label"), {
    target: { value: "D" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0][0]).toMatchObject({
    docNumber: "A-201",
    label: "D",
    title: "Level 2 floor plan",
  });
});
test("new document requires a document number and revision", async () => {
  const submit = vi.fn();
  mount(
    <UploadForm
      file={new File(["pdf"], "drawing.pdf")}
      documents={[]}
      versions={[]}
      pending={false}
      onSubmit={submit}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
  await screen.findByRole("alert");
  expect(submit).not.toHaveBeenCalled();
});
test("only senior QS receives conflict resolution controls", () => {
  const document = documents.find((d) => d.docNumber === "CON-004")!;
  const files = versions.filter((v) => v.documentId === document.id);
  mount(
    <ConflictResolution
      document={document}
      versions={files}
      user={users.find((u) => u.role === "viewer")}
    />,
  );
  expect(screen.queryByRole("button", { name: "Set as current" })).toBeNull();
  expect(
    screen.getByText("A senior QS must resolve this version conflict."),
  ).toBeVisible();
  cleanup();
  mount(
    <ConflictResolution document={document} versions={files} user={users[0]} />,
  );
  expect(
    screen.getAllByRole("button", { name: "Set as current" }),
  ).toHaveLength(2);
});

test("conflict resolution requires a reason and submits the selected version", async () => {
  const document = documents.find((d) => d.docNumber === "CON-004")!;
  const files = versions.filter((v) => v.documentId === document.id);
  const resolve = vi.spyOn(resources, "setCurrent").mockResolvedValue(document);
  mount(
    <ConflictResolution document={document} versions={files} user={users[0]} />,
  );
  fireEvent.submit(
    screen
      .getAllByRole("button", { name: "Set as current" })[0]
      .closest("form")!,
  );
  expect(resolve).not.toHaveBeenCalled();
  fireEvent.change(screen.getAllByLabelText("Reason")[0], {
    target: { value: "Verified against the issued contract." },
  });
  fireEvent.submit(
    screen
      .getAllByRole("button", { name: "Set as current" })[0]
      .closest("form")!,
  );
  await waitFor(() =>
    expect(resolve).toHaveBeenCalledWith(document.id, {
      versionId: files[0].id,
      reason: "Verified against the issued contract.",
    }),
  );
  resolve.mockRestore();
});
