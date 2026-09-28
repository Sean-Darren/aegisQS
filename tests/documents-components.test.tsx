// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { UploadForm } from "@/features/documents/components/upload-form";
import { ProgressMatrix } from "@/features/documents/components/progress-matrix";
import { createFixtures } from "@/mocks/fixtures/data";
import en from "@/messages/en.json";

afterEach(cleanup);
const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {node}
  </NextIntlClientProvider>
);

test("upload form requires a type and a tenderer for every priced BOQ", async () => {
  const tenderers = createFixtures().tenderers;
  const upload = vi.fn(async () => {});
  render(wrap(<UploadForm tenderers={tenderers} onUpload={upload} />));
  fireEvent.change(screen.getByLabelText("Choose files"), {
    target: {
      files: [new File(["rates"], "priced.csv", { type: "text/csv" })],
    },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Upload selected files" }),
  );
  expect(
    screen.getByText("Select a document type for this file."),
  ).toBeTruthy();
  expect(upload).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Document type" }), {
    target: { value: "priced_boq" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Upload selected files" }),
  );
  expect(
    screen.getByText("Select a tenderer for this priced BOQ."),
  ).toBeTruthy();
  expect(upload).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Tenderer" }), {
    target: { value: tenderers[0].id },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Upload selected files" }),
  );
  await waitFor(() =>
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "priced_boq",
        tendererId: tenderers[0].id,
      }),
      expect.any(Function),
    ),
  );
});

test("progress matrix exposes each auditor state and retries only failed cells", () => {
  const fixtures = createFixtures();
  const job = structuredClone(fixtures.jobs[0]);
  job.status = "partial";
  job.progress[0] = {
    ...job.progress[0],
    status: "failed",
    pct: 42,
    error: "Source file needs review.",
  };
  const retry = vi.fn();
  render(
    wrap(
      <ProgressMatrix
        job={job}
        tenderers={fixtures.tenderers}
        canRetry
        onRetry={retry}
      />,
    ),
  );
  expect(screen.getByText("Source file needs review.")).toBeTruthy();
  expect(screen.getByText("42%")).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: /Retry auditor/ });
  expect(buttons).toHaveLength(1);
  fireEvent.click(buttons[0]);
  expect(retry).toHaveBeenCalledWith("T-001", "scope_completeness");
});
