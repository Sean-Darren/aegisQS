"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Button,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { inputStyle } from "@/components/ui/form-styles";
import { resources, queryKeys } from "@/lib/api";
import type { Workbook, WorkbookVersion, ColumnMapping } from "@/schemas";
import { mappingFields, mappingValid, suggestColumns } from "../model";
export function MappingWizard({
  workbook,
  version,
  onClose,
}: {
  workbook: Workbook;
  version: WorkbookVersion;
  onClose: () => void;
}) {
  const t = useTranslations("Workbooks");
  const client = useQueryClient();
  const [step, setStep] = useState(1);
  const [mapping, setMapping] = useState<ColumnMapping>(
    workbook.mapping ?? {
      sheet: version.sheetNames[0],
      headerRow: 1,
      columns: {
        itemRef: "",
        description: "",
        unit: "",
        quantity: "",
        rate: "",
        amount: "",
      },
    },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const preview = useQuery({
    queryKey: queryKeys.sheet(version.id, {
      sheet: mapping.sheet,
      fromRow: mapping.headerRow,
      toRow: mapping.headerRow + 15,
    }),
    queryFn: () =>
      resources.sheet(version.id, {
        sheet: mapping.sheet,
        fromRow: mapping.headerRow,
        toRow: mapping.headerRow + 15,
      }),
  });
  const columns = [
    ...new Set(
      preview.data?.rows.flatMap((r) => r.cells.map((c) => c.column)) ?? [],
    ),
  ];
  const suggestions = suggestColumns(
    preview.data?.rows ?? [],
    mapping.headerRow,
  );
  const valid = mappingValid(mapping);
  async function save() {
    setPending(true);
    setError(false);
    try {
      await resources.updateMapping(workbook.id, mapping);
      await client.invalidateQueries();
      onClose();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] w-[min(900px,calc(100vw-2rem))] overflow-auto">
        <DialogTitle className="text-lg font-semibold">
          {t("mapping")}
        </DialogTitle>
        <DialogDescription>{t("mappingStep", { step })}</DialogDescription>
        {step === 1 && (
          <div className="space-y-3">
            <label>
              {t("sheet")}
              <select
                className={inputStyle}
                value={mapping.sheet}
                onChange={(e) =>
                  setMapping({ ...mapping, sheet: e.target.value })
                }
              >
                {version.sheetNames.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              {t("headerRow")}
              <input
                type="number"
                min={1}
                className={inputStyle}
                value={mapping.headerRow}
                onChange={(e) =>
                  setMapping({ ...mapping, headerRow: Number(e.target.value) })
                }
              />
            </label>
            {preview.isPending && <Skeleton className="h-32 w-full" />}
            {preview.isError && <ErrorState message={t("error")} />}
            <div className="overflow-auto">
              <table className="w-full text-sm tabular-nums">
                <caption>{t("preview15")}</caption>
                <tbody>
                  {preview.data?.rows.slice(0, 15).map((r) => (
                    <tr key={r.row}>
                      <th scope="row">{r.row}</th>
                      {r.cells.map((c) => (
                        <td key={c.column} className="border border-line p-1">
                          {c.value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {mappingFields.map((field) => (
              <label key={field}>
                {t(`fields.${field}`)}
                <select
                  className={`${inputStyle} ${mapping.columns[field] === suggestions[field] && suggestions[field] ? "bg-limewash-100" : ""}`}
                  aria-label={t(`fields.${field}`)}
                  value={mapping.columns[field] ?? ""}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      columns: { ...mapping.columns, [field]: e.target.value },
                    })
                  }
                >
                  <option value="">{t("notMapped")}</option>
                  {columns.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="overflow-auto">
            <table className="w-full text-sm tabular-nums">
              <caption>{t("preview5")}</caption>
              <thead>
                <tr>
                  {mappingFields.slice(0, 6).map((f) => (
                    <th scope="col" key={f}>
                      {t(`fields.${f}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data?.rows
                  .filter((r) => r.row > mapping.headerRow)
                  .slice(0, 5)
                  .map((r) => (
                    <tr key={r.row}>
                      {mappingFields.slice(0, 6).map((f) => (
                        <td
                          key={f}
                          className="border border-line p-2 text-right"
                        >
                          {r.cells.find((c) => c.column === mapping.columns[f])
                            ?.value ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!valid && step > 1 && <p role="alert">{t("missingMapping")}</p>}
        {error && <ErrorState message={t("error")} />}
        <div className="mt-4 flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              {t("back")}
            </Button>
          )}
          {step < 3 ? (
            <Button
              disabled={
                preview.isPending ||
                preview.isError ||
                !Number.isInteger(mapping.headerRow) ||
                mapping.headerRow < 1
              }
              onClick={() => {
                if (step === 1)
                  setMapping((m) => ({
                    ...m,
                    columns: suggestColumns(
                      preview.data?.rows ?? [],
                      m.headerRow,
                    ),
                  }));
                setStep(step + 1);
              }}
            >
              {t("next")}
            </Button>
          ) : (
            <span title={!valid ? t("missingMapping") : undefined}>
              <Button disabled={!valid || pending} onClick={() => void save()}>
                {t("saveMapping")}
              </Button>
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
