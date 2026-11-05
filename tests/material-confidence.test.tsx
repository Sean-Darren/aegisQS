// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import { materials, forecasts } from "@/mocks/fixtures/data";
import { MaterialForecastPage } from "@/features/materials/components/material-forecast-page";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/features/procurement", () => ({ ForecastPlanning: () => null }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ data: { role: "viewer" } }),
}));
vi.mock("@/features/materials/hooks/queries", () => ({
  useMaterials: () => ({ data: materials }),
  useForecast: () => ({
    data: {
      ...forecasts[0],
      model: { ...forecasts[0].model, backtestMapePct: 12 },
    },
  }),
}));
afterEach(cleanup);
test("forecast page renders low-confidence copy and keeps the viewer read-only", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MaterialForecastPage materialId={materials[0].id} />
    </NextIntlClientProvider>,
  );
  expect(screen.getAllByText(/Low confidence/).length).toBeGreaterThan(0);
  expect(screen.getByText(/backtest error is 12.0%/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Plan a purchase" })).toBeNull();
  expect(screen.getByText(/Likely .*tonne by Apr 2027/)).toBeVisible();
});
