"use client";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";

export function AuditorNotes({
  notes,
  editable,
  onChange,
}: {
  notes: string;
  editable: boolean;
  onChange?: (notes: string) => void;
}) {
  const t = useTranslations("Reports");
  return (
    <section
      aria-labelledby="auditor-notes-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <h2 id="auditor-notes-title" className="text-lg font-semibold text-ink">
        {t("auditorNotes")}
      </h2>
      <p className="mt-1 text-xs text-muted-ink">{t("generatedLabel")}</p>
      {editable ? (
        <label className="mt-4 block text-sm text-ink">
          {t("editAuditorNotes")}
          <Textarea
            className="mt-1 min-h-40 max-w-prose leading-6"
            value={notes}
            onChange={(event) => onChange?.(event.target.value)}
          />
        </label>
      ) : (
        <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-6 text-ink">
          {notes || t("noAuditorNotes")}
        </p>
      )}
    </section>
  );
}
