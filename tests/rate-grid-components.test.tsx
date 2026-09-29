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
import { RateGrid } from "@/features/rate-grid";
import { createFixtures } from "@/mocks/fixtures/data";
import en from "@/messages/en.json";

const controls = vi.hoisted(() => ({ push: vi.fn() }));
const fixture = createFixtures();
const page = { rows: fixture.rows.slice(0, 5), totalRows: 3000 };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: controls.push }),
  usePathname: () => "/en/projects/P-001/tender/rates",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/features/rate-grid/api", () => ({
  useRateGridData: () => ({
    tenderers: {
      data: fixture.tenderers,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    grid: {
      data: { pages: [page] },
      isPending: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    },
  }),
}));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        end: (index + 1) * estimateSize(),
        size: estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
    scrollToIndex: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  controls.push.mockClear();
});
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();

function mount() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RateGrid projectId="P-001" />
    </NextIntlClientProvider>,
  );
}

test("z-score cells show signed sigma and shade only when benchmark data is sufficient", () => {
  mount();
  const grid = screen.getByRole("grid", { name: "BOQ rates by tenderer" });
  expect(
    Array.from(grid.querySelectorAll("thead tr:first-child th"))
      .slice(0, 6)
      .map((header) => header.textContent),
  ).toEqual([
    "Item ref",
    "Description",
    "Trade",
    "Unit",
    "Quantity",
    "Benchmark rate",
  ]);
  const breach = screen.getByText("−3.0σ");
  expect(breach.closest("span")).toHaveClass("bg-risk-bg");
  const missing = screen.getByText("Insufficient benchmark data").closest("tr");
  expect(missing).not.toBeNull();
  expect(missing?.querySelector(".bg-risk-bg, .bg-caution-bg")).toBeNull();
});

test("arrow keys move focus and Enter opens the flagged cell's evidence", async () => {
  mount();
  const grid = screen.getByRole("grid", { name: "BOQ rates by tenderer" });
  const first = grid.querySelector<HTMLElement>(
    '[data-grid-row="0"][data-grid-column="0"]',
  )!;
  first.focus();
  for (let column = 1; column <= 7; column++) {
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await waitFor(() =>
      expect((document.activeElement as HTMLElement).dataset.gridColumn).toBe(
        String(column),
      ),
    );
  }
  expect((document.activeElement as HTMLElement).textContent).toContain(
    "−3.0σ",
  );
  fireEvent.keyDown(document.activeElement!, { key: "Enter" });
  expect(controls.push).toHaveBeenCalledWith(
    "/en/projects/P-001/tender/rates?evidence=F-001",
    { scroll: false },
  );
});
