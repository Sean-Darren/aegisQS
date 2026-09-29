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
import { DispositionPanel } from "@/features/evidence/components/disposition-panel";
import { createFixtures } from "@/mocks/fixtures/data";
import { users } from "@/mocks/fixtures/users";
import en from "@/messages/en.json";

const fixture = createFixtures();
afterEach(cleanup);

test("junior QS can propose but cannot finalize, and a reason of 10 characters is required", async () => {
  const submit = vi.fn().mockResolvedValue(true);
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DispositionPanel
        flag={fixture.flags[0]}
        user={users[1]}
        pending={false}
        error={false}
        onSubmit={submit}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("button", { name: "Submit proposal" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Record decision" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
    target: { value: "dismiss" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
    target: { value: "too short" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
    target: { value: "Reviewed the cited evidence." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith("proposal", {
      action: "dismiss",
      reason: "Reviewed the cited evidence.",
    }),
  );
});

test("senior QS sees a proposal and can record the final decision", async () => {
  const submit = vi.fn().mockResolvedValue(true);
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DispositionPanel
        flag={fixture.flags[1]}
        user={users[0]}
        pending={false}
        error={false}
        onSubmit={submit}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("Proposal:", { exact: false })).toBeVisible();
  expect(screen.getByRole("button", { name: "Record decision" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Submit proposal" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
    target: { value: "The source supports this decision." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith("decision", {
      action: fixture.flags[1].proposal?.action,
      reason: "The source supports this decision.",
    }),
  );
});
