import { expect, test } from "@playwright/test";
import type { AnalysisJob, WsEvent } from "../../src/schemas";
test("browser HTTP and WebSocket mocks share a complete analysis lifecycle", async ({
  page,
}) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Smart QS" })).toBeVisible();
  const result = await page.evaluate(async () => {
    const prefix = "/api/v1/projects/P-001";
    const grid = await (
      await fetch(`${prefix}/rate-grid?flaggedOnly=true`)
    ).json();
    const events: WsEvent[] = [];
    const url = new URL("/ws", location.href);
    url.protocol = "ws:";
    url.searchParams.set("projectId", "P-001");
    const socket = new WebSocket(url);
    const completion = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error("Analysis did not complete"));
      }, 25000);
      socket.addEventListener("message", (message) => {
        const event = JSON.parse(message.data) as WsEvent;
        events.push(event);
        if (event.type === "job.completed") {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("Socket failed"));
    });
    const job = (await (
      await fetch(`${prefix}/analysis-jobs`, { method: "POST" })
    ).json()) as AnalysisJob;
    await completion;
    socket.close();
    const final = (await (
      await fetch(`/api/v1/analysis-jobs/${job.id}`)
    ).json()) as AnalysisJob;
    const document = await fetch("/api/v1/documents/D-001/file");
    return {
      totalRows: grid.totalRows,
      final,
      flagsCreated: events.filter((event) => event.type === "flag.created")
        .length,
      pdfType: document.headers.get("content-type"),
      pdfMagic: (await document.text()).slice(0, 5),
    };
  });
  expect(result.totalRows).toBe(150);
  expect(result.final.status).toBe("succeeded");
  expect(result.final.progress).toHaveLength(48);
  expect(result.flagsCreated).toBe(3);
  expect(result.pdfType).toBe("application/pdf");
  expect(result.pdfMagic).toBe("%PDF-");
  expect(errors).toEqual([]);
});
