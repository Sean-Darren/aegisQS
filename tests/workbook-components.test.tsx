// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MappingWizard } from "@/features/workbooks/components/mapping-wizard";
import { IssueMarker } from "@/components/grid/issue-marker";
import { mappingValid } from "@/features/workbooks/model";
import { workbooks, workbookVersions, checks } from "@/mocks/fixtures/data";
import messages from "@/messages/en.json";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: import("react").ReactNode }) => (
    <span>{children}</span>
  ),
}));
afterEach(cleanup);
test("mapping blocks missing or duplicate required columns", () => {
  expect(
    mappingValid({
      sheet: "BOQ",
      headerRow: 1,
      columns: {
        itemRef: "A",
        description: "B",
        unit: "C",
        quantity: "D",
        rate: "E",
        amount: "",
      },
    }),
  ).toBe(false);
  expect(
    mappingValid({
      sheet: "BOQ",
      headerRow: 1,
      columns: {
        itemRef: "A",
        description: "B",
        unit: "C",
        quantity: "D",
        rate: "E",
        amount: "E",
      },
    }),
  ).toBe(false);
});
test("mapping wizard blocks saving an incomplete mapping", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <MappingWizard
          workbook={workbooks[0]}
          version={workbookVersions[1]}
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  await screen
    .findByText("Item ref", { selector: "td" })
    .catch(() => undefined);
  await vi.waitFor(() =>
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("button", { name: "Save mapping" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("six required fields");
});
test.each(["error", "warning", "info"] as const)(
  "corner marker communicates %s with text and semantic colour",
  (severity) => {
    const onOpen = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TooltipProvider>
          <IssueMarker check={{ ...checks[0], severity }} onOpen={onOpen} />
        </TooltipProvider>
      </NextIntlClientProvider>,
    );
    const marker = screen.getByRole("button", {
      name: new RegExp(`^${severity}:`, "i"),
    });
    expect(marker).toHaveAttribute("data-severity", severity);
    expect(marker.querySelector("span")).toHaveClass(
      severity === "error"
        ? "border-t-risk"
        : severity === "warning"
          ? "border-t-caution"
          : "border-t-muted-ink",
    );
    fireEvent.click(marker);
    expect(onOpen).toHaveBeenCalledOnce();
  },
);
