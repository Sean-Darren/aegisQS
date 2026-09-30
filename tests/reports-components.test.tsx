// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ReportScoreTable } from "@/features/reports/components/report-score-table";
import { FlaggedTenderers } from "@/features/reports/components/flagged-tenderers";
import { SignOffControls } from "@/features/reports/components/sign-off-controls";
import { SignedVersionsList } from "@/features/reports/components/signed-versions-list";
import { OwnerReportView } from "@/features/reports/components/owner-report-view";
import { ReportPreview } from "@/features/reports/components/report-preview";
import { createFixtures } from "@/mocks/fixtures/data";
import { users } from "@/mocks/fixtures/users";
import en from "@/messages/en.json";

afterEach(cleanup);
const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {node}
  </NextIntlClientProvider>
);

test("report score summary ranks bids and identifies risk in text", () => {
  const { scores, tenderers, bids } = createFixtures();
  render(
    wrap(
      <ReportScoreTable scores={scores} tenderers={tenderers} bids={bids} />,
    ),
  );
  const rows = screen.getAllByRole("row");
  expect(rows[1].textContent).toContain("BuildCorp HK Ltd.");
  expect(rows[1].textContent).toContain("94.2 / 100");
  expect(screen.getAllByText("High risk").length).toBeGreaterThan(0);
});

test("flagged tenderers expose cited reasons and evidence", () => {
  const { flags, tenderers } = createFixtures();
  const onOpenEvidence = vi.fn();
  render(
    wrap(
      <FlaggedTenderers
        flags={flags.slice(0, 2)}
        tenderers={tenderers}
        onOpenEvidence={onOpenEvidence}
        inlineEvidence
      />,
    ),
  );
  fireEvent.click(screen.getByText("BuildCorp HK Ltd."));
  expect(screen.getAllByText(flags[0].description).length).toBeGreaterThan(0);
  const buttons = screen.getAllByRole("button", { name: "View evidence" });
  fireEvent.click(buttons[0]);
  expect(onOpenEvidence).toHaveBeenCalledWith(flags[0].id);
  fireEvent.click(
    screen
      .getAllByText("View evidence")
      .find((item) => item.tagName === "SUMMARY")!,
  );
  expect(screen.getByText(flags[0].evidence[0].excerpt)).toBeTruthy();
});

test("junior QS cannot see sign-off or sharing actions", () => {
  const { reports } = createFixtures();
  const junior = users.find((user) => user.role === "junior_qs")!;
  const { rerender } = render(
    wrap(
      <SignOffControls
        user={junior}
        blockingCount={0}
        recommendedTendererName="BuildCorp HK Ltd."
        reviewHref="/en/projects/P-001/flags?preset=criticalHigh"
        onReviewFlags={vi.fn()}
        onConfirm={vi.fn(async () => true)}
        busy={false}
      />,
    ),
  );
  expect(screen.queryByRole("button", { name: "Sign off report" })).toBeNull();
  rerender(
    wrap(
      <SignedVersionsList
        reports={[
          {
            ...reports[0],
            status: "signed",
            signedBy: "user-senior",
            signedAt: "2026-09-28T00:00:00.000Z",
          },
        ]}
        user={junior}
        signatoryNames={{ "user-senior": "Sample Senior QS" }}
        onDownload={vi.fn()}
        onShare={vi.fn()}
        onCopy={vi.fn()}
      />,
    ),
  );
  expect(screen.getByRole("button", { name: "Download PDF" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Share with owners" }),
  ).toBeNull();
});

test("senior QS sign-off stays disabled while cited high or critical flags need decisions", () => {
  const senior = users.find((user) => user.role === "senior_qs")!;
  render(
    wrap(
      <SignOffControls
        user={senior}
        blockingCount={2}
        recommendedTendererName="BuildCorp HK Ltd."
        reviewHref="/en/projects/P-001/flags?preset=criticalHigh"
        onReviewFlags={vi.fn()}
        onConfirm={vi.fn(async () => true)}
        busy={false}
      />,
    ),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Sign off report",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("owner preview renders signed content and never draft editing controls", () => {
  const fixture = createFixtures();
  const signed = {
    ...fixture.reports[0],
    status: "signed" as const,
    signedBy: "user-senior",
    signedAt: "2026-09-28T00:00:00.000Z",
  };
  render(
    wrap(
      <OwnerReportView
        token="mock-share"
        report={signed}
        project={fixture.projects[0]}
        tenderers={fixture.tenderers}
        bids={fixture.bids}
        scores={fixture.scores}
        flags={fixture.flags.slice(0, 2)}
        signatoryName="Sample Senior QS"
        notes="Reviewed cited data."
        disclaimer="Decision support only."
      />,
    ),
  );
  expect(
    screen.getByRole("heading", { name: "Central Market Rehab Phase 2" }),
  ).toBeTruthy();
  expect(screen.getByText("Sample Senior QS")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "繁體中文" }).getAttribute("href"),
  ).toBe("/zh-HK/shared/mock-share");
  expect(
    screen.queryByRole("textbox", { name: "Edit auditor notes" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Sign off report" })).toBeNull();
});

test("a signed report preview remains read-only even when the viewer may edit drafts", () => {
  const fixture = createFixtures();
  const signed = {
    ...fixture.reports[0],
    status: "signed" as const,
    signedBy: "user-senior",
    signedAt: "2026-09-28T00:00:00.000Z",
  };
  render(
    wrap(
      <ReportPreview
        report={signed}
        projectName={fixture.projects[0].name}
        tenderers={fixture.tenderers}
        bids={fixture.bids}
        scores={fixture.scores}
        flags={fixture.flags.slice(0, 1)}
        defaultTendererId="T-001"
        recommendedTendererId="T-001"
        overrideReason=""
        notes="Reviewed notes."
        disclaimer="Decision support only."
        signatoryName="Sample Senior QS"
        editable
        onRecommendedTendererChange={vi.fn()}
        onOverrideReasonChange={vi.fn()}
        onNotesChange={vi.fn()}
        onOpenEvidence={vi.fn()}
      />,
    ),
  );
  expect(screen.getByText("Reviewed notes.")).toBeTruthy();
  expect(
    screen.queryByRole("combobox", { name: "Recommended tenderer" }),
  ).toBeNull();
  expect(
    screen.queryByRole("textbox", { name: "Edit auditor notes" }),
  ).toBeNull();
});
