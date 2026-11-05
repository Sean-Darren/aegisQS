"use client";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, type FormatLocale } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { recordHref } from "@/components/records/linked-records";
import type { AuditEvent } from "@/schemas";
export function AuditTimeline({
  events,
  projectId,
  onOpenDetail,
}: {
  events: AuditEvent[];
  projectId: string;
  onOpenDetail?: (id: string) => void;
}) {
  const locale = useLocale() as FormatLocale;
  const t = useTranslations("Audit");
  return (
    <ol className="border-l border-line pl-5">
      {events.map((event) => (
        <li key={event.id} className="border-b border-line py-4">
          <p>{event.summary}</p>
          <time dateTime={event.at} className="tabular-nums">
            {formatDate(event.at, locale)}
          </time>
          <p>{event.actorId}</p>
          {onOpenDetail ? (
            <button
              className="text-clay-700 underline"
              onClick={() =>
                onOpenDetail?.(`${event.entityType}:${event.entityId}`)
              }
            >
              {t("viewEntity", { entity: event.entityId })}
            </button>
          ) : (
            <Link
              className="rounded-sm text-clay-700 underline focus-visible:outline-2 focus-visible:outline-clay-600"
              href={recordHref(projectId, event.entityType, event.entityId)}
            >
              {t("viewEntity", { entity: event.entityId })}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
