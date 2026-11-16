"use client";
import { useLocale, useTranslations } from "next-intl";
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
    <ol className="border-l border-line pl-5">
      {events.map((event) => {
        const key = `actions.${event.action}`;
        const title = t.has(key) ? t(key) : fallbackActionLabel(event.action);
        const roleKey = roleLabelKeys[event.actorRole];
        return (
          <li
            key={event.id}
            className="relative border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span
              aria-hidden
              className="absolute -left-[24px] top-6 size-2 rounded-full border border-line bg-clay-400"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-sm text-muted-ink">{event.summary}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-ink">
                  <time dateTime={event.at} className="tabular-nums">
                    {formatDate(event.at, locale)}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{roleKey ? shell(roleKey) : event.actorId}</span>
                </p>
              </div>
              {onOpenDetail ? (
                <button
                  type="button"
                  className="shrink-0 rounded-sm text-sm font-medium text-clay-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                  onClick={() =>
                    onOpenDetail?.(`${event.entityType}:${event.entityId}`)
                  }
                >
                  {t("view")}
                </button>
              ) : (
                <Link
                  className="shrink-0 rounded-sm text-sm font-medium text-clay-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                  href={recordHref(projectId, event.entityType, event.entityId)}
                >
                  {t("view")}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
