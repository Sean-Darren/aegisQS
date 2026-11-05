type Result<T> = { status: string; value: T; error?: { message: string } };
type SliceFile = {
  sliceCount: number;
  getSliceAsync: (
    index: number,
    cb: (r: Result<{ data: number[] }>) => void,
  ) => void;
  closeAsync: (cb?: () => void) => void;
};
type Dialog = {
  close: () => void;
  addEventHandler: (
    event: string,
    handler: (arg: {
      message?: string;
      origin?: string;
      error?: number;
    }) => void,
  ) => void;
};
interface OfficeBridge {
  onReady: (cb: (info: { host: string; platform: string }) => void) => void;
  EventType: { DialogMessageReceived: string; DialogEventReceived: string };
  FileType: { Compressed: string };
  context: {
    requirements?: {
      isSetSupported: (name: string, version: string) => boolean;
    };
    platform: string;
    document: {
      getFileAsync: (
        type: string,
        options: { sliceSize: number },
        cb: (r: Result<SliceFile>) => void,
      ) => void;
    };
    ui: {
      displayDialogAsync: (
        url: string,
        options: { height: number; width: number; displayInIframe: boolean },
        cb: (r: Result<Dialog>) => void,
      ) => void;
      messageParent: (
        message: string,
        options: { targetOrigin: string },
      ) => void;
    };
  };
}
interface Range {
  select: () => void;
}
interface Sheet {
  activate: () => void;
  getRange: (cell: string) => Range;
}
interface ExcelBridge {
  run: (
    cb: (ctx: {
      workbook: { worksheets: { getItem: (sheet: string) => Sheet } };
      sync: () => Promise<void>;
    }) => Promise<void>,
  ) => Promise<void>;
}
declare global {
  interface Window {
    Office?: OfficeBridge;
    Excel?: ExcelBridge;
  }
}
export async function ready() {
  return new Promise<{ host: string; platform: string }>((resolve, reject) => {
    if (!window.Office)
      return reject(
        new Error(
          "Open this task pane from Excel. If already open, reload after Office.js finishes loading.",
        ),
      );
    window.Office.onReady((info) =>
      info.host === "Excel"
        ? resolve(info)
        : reject(new Error("This add-in requires Excel.")),
    );
  });
}
export function signIn(locale = "en") {
  return new Promise<void>((resolve, reject) => {
    const office = window.Office;
    if (!office) return reject(new Error("Office is not ready."));
    if (
      office.context.requirements &&
      !office.context.requirements.isSetSupported("DialogOrigin", "1.1")
    )
      return reject(new Error("Update Excel to use secure dialog messaging."));
    const nonce = crypto.randomUUID();
    const url = new URL("/signin", location.origin);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("locale", locale);
    office.context.ui.displayDialogAsync(
      url.href,
      { height: 60, width: 40, displayInIframe: false },
      (r) => {
        if (r.status !== "succeeded")
          return reject(
            new Error(r.error?.message ?? "Sign-in dialog could not open."),
          );
        const dialog = r.value;
        dialog.addEventHandler(
          office.EventType.DialogMessageReceived,
          (event) => {
            if (event.origin !== location.origin) return;
            try {
              const message: unknown = JSON.parse(event.message ?? "");
              if (
                typeof message === "object" &&
                message !== null &&
                "nonce" in message &&
                message.nonce === nonce
              ) {
                dialog.close();
                resolve();
              }
            } catch {
              /* Ignore unrelated dialog messages. */
            }
          },
        );
        dialog.addEventHandler(office.EventType.DialogEventReceived, () =>
          reject(new Error("Sign-in was closed. Try again.")),
        );
      },
    );
  });
}
export async function exportWorkbook(): Promise<File> {
  const office = window.Office;
  if (!office) throw new Error("Office is not ready.");
  if (office.context.platform === "OfficeOnline")
    throw new Error(
      "Use Excel’s download-a-copy action, then select that .xlsx file below.",
    );
  const file = await new Promise<SliceFile>((resolve, reject) =>
    office.context.document.getFileAsync(
      office.FileType.Compressed,
      { sliceSize: 65536 },
      (r) =>
        r.status === "succeeded"
          ? resolve(r.value)
          : reject(
              new Error(r.error?.message ?? "Workbook export is unavailable."),
            ),
    ),
  );
  try {
    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let i = 0; i < file.sliceCount; i++) {
      const data = await new Promise<number[]>((resolve, reject) =>
        file.getSliceAsync(i, (r) =>
          r.status === "succeeded"
            ? resolve(r.value.data)
            : reject(new Error(r.error?.message ?? "Workbook slice failed.")),
        ),
      );
      parts.push(new Uint8Array(data));
    }
    return new File(parts, "open-workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } finally {
    file.closeAsync();
  }
}
export async function selectCell(sheet: string, cell: string) {
  if (!/^[A-Z]+[1-9]\d*$/.test(cell)) throw new Error("Invalid check cell.");
  if (!window.Excel) throw new Error("Excel is not ready.");
  await window.Excel.run(async (ctx) => {
    const target = ctx.workbook.worksheets.getItem(sheet);
    target.activate();
    target.getRange(cell).select();
    await ctx.sync();
  });
}

export type WorkbookIdentity = {
  workbookId?: string;
  projectId?: string;
  versionNumber?: number;
};

export async function readWorkbookIdentity(): Promise<WorkbookIdentity | null> {
  if (!window.Excel) return null;
  try {
    let identity: WorkbookIdentity | null = null;
    await window.Excel.run(async (rawContext) => {
      const context = rawContext as unknown as {
        workbook?: {
          properties?: {
            custom?: {
              load: (propertyNames: string | string[]) => void;
              items?: Array<{
                key?: string;
                value?: string | number;
              }>;
            };
          };
        };
        sync: () => Promise<void>;
      };
      const custom = context.workbook?.properties?.custom;
      if (!custom?.load) return;
      custom.load("items");
      await context.sync();
      const values = new Map<string, string>();
      for (const item of custom.items ?? []) {
        if (typeof item.key === "string" && item.value !== undefined) {
          values.set(item.key.toLowerCase(), String(item.value));
        }
      }
      const workbookId =
        values.get("aegisqs_workbook_id") ?? values.get("workbook_id");
      const projectId =
        values.get("aegisqs_project_id") ?? values.get("project_id");
      const versionNumber = Number(
        values.get("aegisqs_version_number") ??
          values.get("version_number") ??
          "",
      );
      identity = {
        workbookId,
        projectId,
        versionNumber:
          Number.isInteger(versionNumber) && versionNumber > 0
            ? versionNumber
            : undefined,
      };
    });
    return identity;
  } catch {
    return null;
  }
}
