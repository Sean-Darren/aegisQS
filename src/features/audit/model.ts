import type { AuditEvent } from "@/schemas";

export type AuditFilters = {
  actor: string;
  action: string;
  entityType: AuditEvent["entityType"] | "all";
  from: string;
  to: string;
};

export const initialAuditFilters: AuditFilters = {
  actor: "",
  action: "",
  entityType: "all",
  from: "",
  to: "",
};

export function filterAuditEvents(events: AuditEvent[], filters: AuditFilters) {
  const from = filters.from
    ? Date.parse(`${filters.from}T00:00:00+08:00`)
    : -Infinity;
  const to = filters.to
    ? Date.parse(`${filters.to}T23:59:59.999+08:00`)
    : Infinity;
  return events.filter((event) => {
    const at = Date.parse(event.at);
    return (
      event.actorId
        .toLocaleLowerCase()
        .includes(filters.actor.trim().toLocaleLowerCase()) &&
      event.action
        .toLocaleLowerCase()
        .includes(filters.action.trim().toLocaleLowerCase()) &&
      (filters.entityType === "all" ||
        event.entityType === filters.entityType) &&
      at >= from &&
      at <= to
    );
  });
}

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export function auditEventsCsv(events: AuditEvent[], headings: string[]) {
  const rows = events.map((event) => [
    event.id,
    event.at,
    event.actorId,
    event.actorRole,
    event.action,
    event.entityType,
    event.entityId,
    event.summary,
    event.details ? JSON.stringify(event.details) : "",
  ]);
  return `\uFEFF${[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function fetchAllAuditEvents(
  getPage: (
    cursor?: string,
  ) => Promise<{ data: AuditEvent[]; nextCursor?: string }>,
) {
  const events: AuditEvent[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await getPage(cursor);
    for (const event of page.data) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        events.push(event);
      }
    }
    cursor = page.nextCursor;
  } while (cursor);
  return events;
}
