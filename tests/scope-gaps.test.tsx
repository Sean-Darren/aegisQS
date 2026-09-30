// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ScopeStatusBadge } from "@/features/scope-gaps/components/scope-status-badge";
import {
  exceedsProvisionalSumThreshold,
  hasInspectionReport,
  provisionalSumShare,
  provisionalSumFlagsByTenderer,
  scopeCounts,
  scopeStatuses,
} from "@/features/scope-gaps/model";
import { createFixtures } from "@/mocks/fixtures/data";
import { thresholds } from "@/lib/config";
import en from "@/messages/en.json";

afterEach(cleanup);

test("scope status counts match the register and every chip has text and icon", () => {
  const counts = scopeCounts(createFixtures().scopeGaps);
  expect(counts).toEqual({ mapped: 1, vague: 1, missing: 1, oversized_ps: 1 });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      {scopeStatuses.map((status) => (
        <ScopeStatusBadge key={status} status={status} />
      ))}
    </NextIntlClientProvider>,
  );
  for (const label of ["Mapped", "Vague", "Missing", "Oversized PS"]) {
    const badge = screen
      .getByText(label)
      .closest('[data-slot="scope-status-badge"]');
    expect(badge?.querySelector("svg")).not.toBeNull();
  }
});

test("scope review requests an inspection report when none was uploaded", () => {
  const documents = createFixtures().documents;
  expect(hasInspectionReport(documents)).toBe(true);
  expect(
    hasInspectionReport(
      documents.filter((document) => document.type !== "inspection_report"),
    ),
  ).toBe(false);
});

test("provisional sum shares use the configured 15% threshold", () => {
  const { bids } = createFixtures();
  expect(thresholds.provisionalSumPercent).toBe(15);
  expect(provisionalSumShare(bids[1])).toBeCloseTo(0.22, 3);
  expect(exceedsProvisionalSumThreshold(bids[1])).toBe(true);
  expect(exceedsProvisionalSumThreshold(bids[0])).toBe(false);
  expect(
    exceedsProvisionalSumThreshold({
      ...bids[0],
      provisionalSumHKD: bids[0].totalValueHKD * 0.15,
    }),
  ).toBe(false);
  expect(provisionalSumShare({ ...bids[0], totalValueHKD: 0 })).toBeNull();
});

test("chart links a tenderer to its highest-severity evidenced provisional sum flag", () => {
  const flags = createFixtures().flags.filter(
    (flag) => flag.signal === "provisional_sum_concentration",
  );
  const links = provisionalSumFlagsByTenderer(flags);
  expect(links["T-002"]).toBeDefined();
  expect(
    flags.find((flag) => flag.id === links["T-002"])?.evidence.length,
  ).toBeGreaterThan(0);
});
