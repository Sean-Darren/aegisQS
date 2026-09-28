// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RiskBandBadge, SeverityBadge } from "@/components/ui/status-badges";
import en from "@/messages/en.json";

afterEach(cleanup);
test("severity combines a readable label with an icon", () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SeverityBadge severity="high" />
    </NextIntlClientProvider>,
  );
  const badge = screen.getByText("High").closest('[data-slot="status-badge"]');
  expect(badge).not.toBeNull();
  expect(badge?.querySelector("svg")).not.toBeNull();
});
test("risk band distinguishes score meaning in text and icon", () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RiskBandBadge band="critical" />
    </NextIntlClientProvider>,
  );
  const badge = screen
    .getByText("Critical risk")
    .closest('[data-slot="status-badge"]');
  expect(badge).not.toBeNull();
  expect(badge?.querySelector("svg")).not.toBeNull();
});
