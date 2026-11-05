// @vitest-environment jsdom
import { test, expect, vi } from "vitest";
import { selectCell, exportWorkbook, signIn } from "../addin/src/office";
import en from "../addin/messages/en.json";
import zh from "../addin/messages/zh-HK.json";
test("cell navigation only activates and selects; invalid addresses do not call Excel", async () => {
  const select = vi.fn(),
    activate = vi.fn(),
    sync = vi.fn();
  Object.assign(window, {
    Excel: {
      run: async (fn: (ctx: unknown) => Promise<void>) =>
        fn({
          workbook: {
            worksheets: {
              getItem: () => ({ activate, getRange: () => ({ select }) }),
            },
          },
          sync,
        }),
    },
  });
  await selectCell("BOQ", "F40");
  expect(select).toHaveBeenCalledOnce();
  expect(activate).toHaveBeenCalledOnce();
  expect(sync).toHaveBeenCalledOnce();
  await expect(selectCell("BOQ", "A1:B4")).rejects.toThrow(
    "Invalid check cell",
  );
});
test("desktop compressed export closes the file after reading every slice", async () => {
  const closeAsync = vi.fn();
  Object.assign(window, {
    Office: {
      FileType: { Compressed: "compressed" },
      context: {
        platform: "PC",
        document: {
          getFileAsync: (
            _type: string,
            _options: unknown,
            cb: (result: unknown) => void,
          ) =>
            cb({
              status: "succeeded",
              value: {
                sliceCount: 2,
                getSliceAsync: (
                  i: number,
                  callback: (result: unknown) => void,
                ) =>
                  callback({
                    status: "succeeded",
                    value: { data: i ? [3, 4] : [1, 2] },
                  }),
                closeAsync,
              },
            }),
        },
      },
    },
  });
  const file = await exportWorkbook();
  expect(file.size).toBe(4);
  expect(closeAsync).toHaveBeenCalledOnce();
});
test("add-in dictionaries have matching keys and no banned promise copy", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  expect(JSON.stringify([en, zh])).not.toMatch(
    /guaranteed|certainly|will definitely|risk-free|100% accurate|fraud/i,
  );
});
test("web export fails explicitly rather than exporting PDF as a workbook", async () => {
  Object.assign(window, { Office: { context: { platform: "OfficeOnline" } } });
  await expect(exportWorkbook()).rejects.toThrow("download-a-copy");
});

test("dialog messages must match both origin and nonce", async () => {
  const handlers: Record<
    string,
    (event: { origin: string; message: string }) => void
  > = {};
  let nonce = "";
  const close = vi.fn();
  Object.assign(window, {
    Office: {
      EventType: {
        DialogMessageReceived: "message",
        DialogEventReceived: "closed",
      },
      context: {
        ui: {
          displayDialogAsync: (
            url: string,
            _options: unknown,
            cb: (result: unknown) => void,
          ) => {
            nonce = new URL(url).searchParams.get("nonce")!;
            cb({
              status: "succeeded",
              value: {
                close,
                addEventHandler: (
                  name: string,
                  handler: (typeof handlers)[string],
                ) => {
                  handlers[name] = handler;
                },
              },
            });
          },
        },
      },
    },
  });
  const signedIn = signIn();
  handlers.message({
    origin: "https://untrusted.example",
    message: JSON.stringify({ nonce }),
  });
  expect(close).not.toHaveBeenCalled();
  handlers.message({
    origin: location.origin,
    message: JSON.stringify({ nonce: "wrong" }),
  });
  expect(close).not.toHaveBeenCalled();
  handlers.message({
    origin: location.origin,
    message: JSON.stringify({ nonce }),
  });
  await signedIn;
  expect(close).toHaveBeenCalledOnce();
});
