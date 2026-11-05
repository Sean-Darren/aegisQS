// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { StatusChip } from "@/components/ui/StatusChip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Combobox } from "@/components/ui/Combobox";
import { LowConfidenceNote } from "@/components/ui/LowConfidenceNote";
import { AiGeneratedLabel } from "@/components/ui/AiGeneratedLabel";
import { Dropzone } from "@/components/ui/Dropzone";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
function mount(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>,
  );
}
afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
test("status chips carry icon, readable label and semantic colour", () => {
  mount(
    <>
      <StatusChip domain="changeKind" value="added" />
      <StatusChip domain="variationStatus" value="confirmed" />
      <StatusChip domain="checkSeverity" value="error" compact />
    </>,
  );
  expect(screen.getByText("Added")).toHaveClass("text-rev-target");
  expect(screen.getByText("Confirmed").querySelector("svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(screen.getByText("Error")).toHaveClass("h-5", "rounded-sm");
});
test("low confidence thresholds are strict and AI provenance remains visible", () => {
  const { rerender } = mount(<LowConfidenceNote confidence={0.59} />);
  expect(screen.getByText("Low confidence — check visually")).toBeVisible();
  rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LowConfidenceNote confidence={0.6} />
      <LowConfidenceNote kind="alignment" confidence={0.8} />
      <LowConfidenceNote kind="forecast" confidence="high" />
      <AiGeneratedLabel />
    </NextIntlClientProvider>,
  );
  expect(screen.queryByText("Low confidence — check visually")).toBeNull();
  expect(screen.getByText("AI-generated")).toBeVisible();
});
test("segmented control changes selection without allowing an empty value", () => {
  const change = vi.fn();
  mount(
    <SegmentedControl
      label="Viewer mode"
      value="overlay"
      onValueChange={change}
      options={[
        { value: "overlay", label: "Overlay" },
        { value: "swipe", label: "Swipe" },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("radio", { name: "Overlay" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "Swipe" }));
  expect(change).toHaveBeenCalledWith("swipe");
});
test("combobox filters, selects with Enter and dismisses with Escape", async () => {
  const change = vi.fn();
  mount(
    <Combobox
      label="BOQ item"
      value=""
      onValueChange={change}
      options={[
        { value: "a", label: "Concrete" },
        { value: "b", label: "Rebar" },
      ]}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "reb" } });
  await screen.findByRole("option", { name: "Rebar" });
  expect(screen.queryByRole("option", { name: "Concrete" })).toBeNull();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("b");
  expect(input).toHaveAttribute("aria-expanded", "false");
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveAttribute("aria-expanded", "false");
});
test("combobox announces empty results and skips disabled choices", async () => {
  const change = vi.fn();
  mount(
    <Combobox
      label="Item"
      value=""
      onValueChange={change}
      options={[
        { value: "a", label: "Concrete", disabled: true },
        { value: "b", label: "Rebar" },
      ]}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("b");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "unknown" } });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "No matching options",
  );
});
test("dropzone accepts files, reports rejection and disables selection", async () => {
  const files = vi.fn();
  const rejected = vi.fn();
  const { container } = mount(
    <Dropzone
      label="Drawing files"
      onFiles={files}
      onRejected={rejected}
      maxSize={10}
    />,
  );
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, {
    target: {
      files: [new File(["data"], "A-201.pdf", { type: "application/pdf" })],
    },
  });
  await waitFor(() => expect(files).toHaveBeenCalled());
  fireEvent.change(input, {
    target: {
      files: [
        new File(["way too much content"], "large.pdf", {
          type: "application/pdf",
        }),
      ],
    },
  });
  await waitFor(() => expect(rejected).toHaveBeenCalled());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Some files could not be accepted",
  );
  cleanup();
  mount(<Dropzone label="Files" onFiles={files} disabled />);
  expect(screen.getByRole("button", { name: "Choose files" })).toBeDisabled();
});
test("on-ink buttons use a transparent surface with light text", () => {
  mount(<Button variant="on-ink">Fit drawing</Button>);
  expect(screen.getByRole("button")).toHaveClass(
    "bg-transparent",
    "text-limewash",
    "hover:bg-sidebar-hover",
  );
});
