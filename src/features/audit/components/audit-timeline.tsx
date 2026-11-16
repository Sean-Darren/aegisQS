"use client";
import { useLocale, useTranslations } from "next-intl";
import { Calendar, ChevronRight, User } from "lucide-react";
import { formatDate, type FormatLocale } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { recordHref } from "@/components/records/linked-records";
import type { AuditEvent } from "@/schemas";

const roleLabelKeys: Record<string, string> = {
  senior_qs: "roleSenior",
  qs: "roleQs",
  viewer: "roleViewer",
  admin: "roleAdmin",
};

/** Human label for actions without a curated translation, e.g.
 * "comparison.completed" -> "Completed". */
function fallbackActionLabel(action: string) {
  const tail = action.split(".").slice(1).join(" ").replace(/_/g, " ");
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

const rowClass =
  "group relative flex w-full items-start gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600";

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
  const shell = useTranslations("Shell");
  return (
    <ol className="border-l border-line pl-4">
      {events.map((event) => {
        const key = `actions.${event.action}`;
        const title = t.has(key) ? t(key) : fallbackActionLabel(event.action);
        const roleKey = roleLabelKeys[event.actorRole];
        const content = (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{title}</p>
              <p className="mt-0.5 text-sm text-muted-ink">{event.summary}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-ink">
                <span className="flex items-center gap-1">
                  <Calendar
                    size={12}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <time dateTime={event.at} className="tabular-nums">
                    {formatDate(event.at, locale)}
                  </time>
                </span>
                <span className="flex items-center gap-1">
                  <User
                    size={12}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  {roleKey ? shell(roleKey) : event.actorId}
                </span>
              </p>
            </div>
            <ChevronRight
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-1 shrink-0 text-muted-ink opacity-0 transition-opacity group-hover:opacity-100"
            />
          </>
        );
        return (
          <li key={event.id} className="border-b border-line last:border-b-0">
            {onOpenDetail ? (
              <button
                type="button"
                className={rowClass}
                onClick={() =>
                  onOpenDetail?.(`${event.entityType}:${event.entityId}`)
                }
              >
                {content}
              </button>
            ) : (
              <Link
                className={rowClass}
                href={recordHref(projectId, event.entityType, event.entityId)}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
