// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { materials, forecasts } from "@/mocks/fixtures/data";
import { buildFanChartOptions } from "@/features/materials/chart-options";
import { FanChart } from "@/features/materials/components/fan-chart";
import { forecastAt, lowForecastConfidence } from "@/features/materials/model";
vi.mock("@/components/charts/echarts-core", () => ({
  AegisEChart: ({ option }: { option: unknown }) => (
    <pre data-testid="chart-options">{JSON.stringify(option)}</pre>
  ),
}));
vi.mock("@/components/charts/theme", () => ({
  registerAegisTheme: () => "aegisqs",
}));
afterEach(cleanup);
const material = materials.find((m) => m.id === "rebar")!,
  forecast = forecasts.find((f) => f.materialId === "rebar")!;
const colors = {
  ink: "var(--ink)",
  median: "var(--clay-700)",
  band80: "var(--limewash)",
  band95: "var(--limewash-100)",
  muted: "var(--muted-ink)",
};
const labels = {
  history: "History",
  median: "Median",
  band80: "80%",
  band95: "95%",
  latest: "Latest data",
  unitAxis: "HK$ / tonne",
};
test("fan bands stack from their lower bounds and reach each supplied upper bound", () => {
  const options = buildFanChartOptions(material, forecast, 12, labels, colors);
  const start = forecast.history.length;
  for (const [id, lower, upper] of [
    ["range80", "p10", "p90"],
    ["range95", "p025", "p975"],
  ] as const) {
    const base = options.series.find((s) => s.id === `${id}-lower`)!,
      band = options.series.find((s) => s.id === id)!;
    expect(base).toMatchObject({ stack: id });
    expect(band).toMatchObject({ stack: id });
    forecast.forecast.forEach((p, i) => {
      expect(base.data[start + i]).toBe(p[lower]);
      expect(band.data[start + i]).toBe(p[upper] - p[lower]);
      expect(Number(base.data[start + i]) + Number(band.data[start + i])).toBe(
        p[upper],
      );
      expect(Number(base.data[start + i])).toBeGreaterThan(0);
    });
  }
  expect(options.series.find((s) => s.id === "median")?.data[start - 1]).toBe(
    forecast.history.at(-1)?.price,
  );
});
test("horizon affects only future chart periods; tooltip includes both ranges with the median", () => {
  const options = buildFanChartOptions(material, forecast, 3, labels, colors);
  expect(options.xAxis.data).toHaveLength(forecast.history.length + 3);
  expect(
    options.tooltip.formatter([{ dataIndex: forecast.history.length }]),
  ).toMatch(/Median.*tonne\n80%:.*\n95%:/);
  expect(forecast.forecast).toHaveLength(12);
  expect(forecastAt(forecast, material.latestPeriod, 3)?.period).toBe(
    "2027-01",
  );
  expect(forecastAt(forecast, material.latestPeriod, 6)?.period).toBe(
    "2027-04",
  );
});
test("low confidence is strictly above the configured 10 percent boundary", () => {
  expect(lowForecastConfidence(10)).toBe(false);
  expect(lowForecastConfidence(10.01)).toBe(true);
});
test("fan component passes the percentile bands through the shared chart wrapper", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FanChart material={material} forecast={forecast} horizon={6} />
    </NextIntlClientProvider>,
  );
  const options = JSON.parse(screen.getByTestId("chart-options").textContent!);
  expect(
    options.series.find((s: { id: string }) => s.id === "range80-lower")
      .data[60],
  ).toBe(forecast.forecast[0].p10);
  expect(
    options.series.find((s: { id: string }) => s.id === "range95-lower")
      .data[60],
  ).toBe(forecast.forecast[0].p025);
});

test("procurement overlay spans the supplied window and uses exact dates for labelled lines", async () => {
  const { procurement } = await import("@/mocks/fixtures/data");
  const advice = procurement[0];
  const options = buildFanChartOptions(
    material,
    forecast,
    12,
    {
      ...labels,
      buyWindow: "Recommended buy window",
      latestOrder: "Latest order",
      neededBy: "Need by",
    },
    { ...colors, window: "var(--lichen)", caution: "var(--caution)" },
    "en",
    advice,
  );
  const overlay = options.series.find((s) => "markArea" in s)!;
  if (!("markArea" in overlay)) throw new Error("Missing procurement overlay");
  expect(overlay.markArea?.itemStyle).toEqual({
    color: "var(--lichen)",
    opacity: 0.35,
  });
  expect(overlay.markArea?.data[0]).toEqual([
    {
      name: "Recommended buy window",
      xAxis: options.xAxis.data.indexOf("2027-02") - 0.5,
    },
    { xAxis: options.xAxis.data.indexOf("2027-03") + 0.5 },
  ]);
  expect(overlay.markLine?.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "Latest order",
        lineStyle: expect.objectContaining({
          type: "dashed",
          color: "var(--caution)",
        }),
      }),
      expect.objectContaining({
        name: "Need by",
        lineStyle: expect.objectContaining({
          type: "solid",
          color: "var(--ink)",
        }),
      }),
    ]),
  );
  const short = buildFanChartOptions(
    material,
    forecast,
    3,
    labels,
    colors,
    "en",
    advice,
  );
  const shortOverlay = short.series.find((s) => "markArea" in s)!;
  if (!("markArea" in shortOverlay))
    throw new Error("Missing procurement overlay");
  expect(shortOverlay.markArea).toBeUndefined();
  expect(shortOverlay.markLine?.data).toEqual([]);
});
