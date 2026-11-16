"use client";
import { EntityActivity } from "@/components/records/entity-activity";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { resources, queryKeys } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  StatusChip,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components/ui";
import { VirtualTable } from "@/components/grid";
import { SheetGrid } from "@/components/grid/sheet-grid";
import { inputStyle } from "@/components/ui/form-styles";
import {
  formatCurrency,
  formatUnitRate,
  formatDate,
  type FormatLocale,
} from "@/lib/format";
import { useWorkbook, useVersion, useVersions } from "../hooks/queries";
import { MappingWizard } from "./mapping-wizard";
import { WorkbookUpload } from "./upload";
import { CheckActions } from "./check-detail";
import { CheckSummary } from "./workbooks-page";
import { mappingFields } from "../model";
import type { Workbook, WorkbookCheck } from "@/schemas";
import { allVersionItems } from "../diff-model";
import { DiffTab } from "./diff-tab";
export function WorkbookPage({ workbookId }: { workbookId: string }) {
  const t = useTranslations("Workbooks");
  const query = useWorkbook(workbookId);
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState message={t("error")} />;
  return <Workspace key={workbookId} workbook={query.data} />;
}
function Workspace({ workbook }: { workbook: Workbook }) {
  const t = useTranslations("Workbooks");
  const locale = useLocale() as FormatLocale;
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const versionId = params.get("version") || workbook.currentVersionId || "";
  const version = useVersion(versionId);
  const history = useVersions(workbook);
  const [tab, setTab] = useState("checks");
  const [sheet, setSheet] = useState("");
  const [selected, setSelected] = useState("");
  const [mapping, setMapping] = useState(params.get("mapping") === "1");
  const [upload, setUpload] = useState(params.get("upload") === "1");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [syncedVersionId, setSyncedVersionId] = useState(versionId);
  if (syncedVersionId !== versionId) {
    // Switching versions through the versions tab or diff chart changes
    // ?version= without remounting; the new version may not share sheet
    // names, so drop stale sheet/cell selections.
    setSyncedVersionId(versionId);
    setSheet("");
    setSelected("");
  }
  const checks = useQuery({
    queryKey: queryKeys.checks(versionId),
    queryFn: () => resources.checks(versionId),
    enabled: !!versionId,
  });
  const sheetName = sheet || version.data?.sheetNames[0] || "";
  const preview = useQuery({
    queryKey: queryKeys.sheet(versionId, {
      sheet: sheetName,
      fromRow: 1,
      toRow: 5000,
    }),
    queryFn: async () => {
      const result = await resources.sheet(versionId, {
        sheet: sheetName,
        fromRow: 1,
        toRow: 1000,
      });
      let part = result,
        from = 1001;
      const rows = [...result.rows];
      // The cache key promises toRow: 5000; never fetch beyond that cap.
      while (part.rows.length === 1000 && rows.length < 5000) {
        part = await resources.sheet(versionId, {
          sheet: sheetName,
          fromRow: from,
          toRow: from + 999,
        });
        rows.push(...part.rows);
        from += 1000;
      }
      return { ...result, toRow: from - 1, rows };
    },
    enabled: !!sheetName && !!versionId && tab === "sheet",
  });
  const sheetRows = useMemo(
    () =>
      preview.data?.rows.filter(
        (r) =>
          !errorsOnly ||
          checks.data?.some(
            (c) =>
              c.sheet === sheetName &&
              c.severity === "error" &&
              c.cell.replace(/\D/g, "") === String(r.row),
          ),
      ) ?? [],
    [preview.data, errorsOnly, checks.data, sheetName],
  );
  function show(c: WorkbookCheck) {
    setSheet(c.sheet);
    setSelected(c.cell);
    setTab("sheet");
  }
  function open(c: WorkbookCheck) {
    router.push(
      `/projects/${workbook.projectId}/workbooks/${workbook.id}?version=${versionId}&detail=check:${encodeURIComponent(c.id)}`,
      { scroll: false },
    );
  }
  async function download(annotated: boolean) {
    setDownloadError(false);
    try {
      const blob = await resources.downloadWorkbook(versionId, annotated);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = version.data?.fileName ?? "workbook.xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(true);
    }
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{workbook.name}</h1>
        <p>{t("readOnly")}</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <label>
          {t("version")}
          <select
            aria-label={t("version")}
            className={inputStyle}
            value={versionId}
            onChange={(e) => {
              router.replace(
                `/projects/${workbook.projectId}/workbooks/${workbook.id}?version=${e.target.value}`,
                { scroll: false },
              );
              setSelected("");
              setSheet("");
            }}
          >
            {(history.data ?? (version.data ? [version.data] : [])).map((v) => (
              <option key={v.id} value={v.id}>
                {t("versionNumber", { number: v.versionNumber })}
                {v.id === workbook.currentVersionId ? ` · ${t("current")}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!version.data}
          onClick={() => void download(false)}
        >
          {t("download")}
        </Button>
        <Button
          variant="outline"
          disabled={!version.data}
          onClick={() => void download(true)}
        >
          {t("annotated")}
        </Button>
        {can(session.data, "workbook.upload") && (
          <Button onClick={() => setUpload((v) => !v)}>
            {t("uploadVersion")}
          </Button>
        )}
        {can(session.data, "workbook.editMapping") && (
          <Button
            variant="outline"
            disabled={!version.data}
            onClick={() => setMapping(true)}
          >
            {t("editMapping")}
          </Button>
        )}
      </div>
      {version.isPending && <Skeleton className="h-24 w-full" />}
      {(version.isError || history.isError || downloadError) && (
        <ErrorState message={t("error")} />
      )}
      {version.data && (
        <>
          <div
            role="status"
            aria-live="polite"
            className="space-y-2 rounded-md border border-line bg-panel p-3"
          >
            <p>{t(`states.${version.data.status}`)}</p>
            {["parsing", "checking"].includes(version.data.status) && (
              <p>{t("background")}</p>
            )}
            <CheckSummary summary={version.data.checkSummary} />
          </div>
          {versionId !== workbook.currentVersionId && (
            <p className="bg-stone-50 p-3">{t("historical")}</p>
          )}
          {upload && can(session.data, "workbook.upload") && (
            <WorkbookUpload
              workbook={workbook}
              projectId={workbook.projectId}
            />
          )}
          {mapping && can(session.data, "workbook.editMapping") && (
            <MappingWizard
              workbook={workbook}
              version={version.data}
              onClose={() => {
                setMapping(false);
                router.replace(
                  `/projects/${workbook.projectId}/workbooks/${workbook.id}?version=${versionId}`,
                  { scroll: false },
                );
              }}
            />
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              {["checks", "sheet", "items", "versions", "diff"].map((k) => (
                <TabsTrigger key={k} value={k}>
                  {t(k)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="checks">
              <div className="space-y-4 pt-4">
                {checks.isPending && <Skeleton className="h-48 w-full" />}
                {checks.isError && <ErrorState message={t("error")} />}
                {checks.data?.length === 0 && (
                  <EmptyState message={t("noChecks")} />
                )}
                {(["error", "warning", "info"] as const).map((severity) =>
                  [
                    ...new Set(
                      checks.data
                        ?.filter((c) => c.severity === severity)
                        .map((c) => c.rule),
                    ),
                  ].map((rule) => (
                    <section
                      key={rule}
                      className="space-y-3 rounded-md border border-line bg-panel p-4"
                    >
                      <h2 className="font-semibold">
                        <StatusChip domain="checkSeverity" value={severity} />{" "}
                        {t(`rules.${rule}`)}
                      </h2>
                      {checks.data
                        ?.filter(
                          (c) => c.rule === rule && c.severity === severity,
                        )
                        .map((c) => (
                          <article
                            key={c.id}
                            className="space-y-2 border-t border-line pt-3"
                          >
                            <div className="flex flex-wrap justify-between">
                              <button
                                className="text-clay-700 underline"
                                onClick={() => open(c)}
                              >
                                {c.sheet}!{c.cell} · {c.itemRef}
                              </button>
                              <span>{t(`statuses.${c.status}`)}</span>
                            </div>
                            <p>{c.message}</p>
                            <Button variant="ghost" onClick={() => show(c)}>
                              {t("showSheet")}
                            </Button>
                            <CheckActions check={c} />
                          </article>
                        ))}
                    </section>
                  )),
                )}
              </div>
            </TabsContent>
            <TabsContent value="sheet">
              <div className="space-y-3 pt-4">
                <label>
                  <input
                    type="checkbox"
                    checked={errorsOnly}
                    onChange={(e) => setErrorsOnly(e.target.checked)}
                  />{" "}
                  {t("errorsOnly")}
                </label>
                {preview.isPending && <Skeleton className="h-96 w-full" />}
                {preview.isError && <ErrorState message={t("error")} />}
                {preview.data && (
                  <SheetGrid
                    key={`${versionId}:${sheetName}:${selected}:${errorsOnly}`}
                    rows={sheetRows}
                    checks={(checks.data ?? []).filter(
                      (c) => c.sheet === sheetName,
                    )}
                    mapping={workbook.mapping}
                    labels={Object.fromEntries(
                      mappingFields.map((f) => [f, t(`fields.${f}`)]),
                    )}
                    label={t("sheetGrid")}
                    selectedCell={selected}
                    onOpen={open}
                  />
                )}
                <div className="flex gap-3">
                  {version.data.sheetNames.map((s) => (
                    <Button
                      variant="ghost"
                      aria-pressed={s === sheetName}
                      key={s}
                      onClick={() => {
                        setSheet(s);
                        setSelected("");
                      }}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="items">
              <Items versionId={versionId} />
            </TabsContent>
            <TabsContent value="diff">
              <DiffTab
                workbook={workbook}
                versions={history.data ?? []}
                onSelectVersion={(id) =>
                  router.replace(
                    `/projects/${workbook.projectId}/workbooks/${workbook.id}?version=${id}`,
                    { scroll: false },
                  )
                }
              />
            </TabsContent>
            <TabsContent value="versions">
              <div className="space-y-3 pt-4">
                {history.data?.map((v) => (
                  <article
                    key={v.id}
                    className="space-y-2 border border-line bg-panel p-4"
                  >
                    <Button
                      variant="ghost"
                      onClick={() => {
                        router.replace(
                          `/projects/${workbook.projectId}/workbooks/${workbook.id}?version=${v.id}`,
                          { scroll: false },
                        );
                        setTab("checks");
                      }}
                    >
                      {t("versionNumber", { number: v.versionNumber })} ·{" "}
                      {v.fileName}
                    </Button>
                    <p className="tabular-nums">
                      {v.uploadedBy} · {formatDate(v.uploadedAt, locale)}
                    </p>
                    <CheckSummary summary={v.checkSummary} />
                    {v.totals?.map((total) => (
                      <p key={total.sheet} className="tabular-nums">
                        {total.sheet} · {formatCurrency(total.amount)}
                      </p>
                    ))}
                  </article>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          <EntityActivity
            projectId={workbook.projectId}
            entities={[
              { type: "workbook", id: workbook.id },
              ...(checks.data ?? []).map((c) => ({
                type: "check" as const,
                id: c.id,
              })),
              ...(versionId
                ? [{ type: "workbook_version" as const, id: versionId }]
                : []),
            ]}
          />
        </>
      )}
    </div>
  );
}
function Items({ versionId }: { versionId: string }) {
  const t = useTranslations("Workbooks");
  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const query = useQuery({
    queryKey: queryKeys.items(versionId),
    queryFn: () =>
      allVersionItems((cursor) => resources.items(versionId, { cursor })),
  });
  const rows = (query.data ?? []).filter(
    (i) =>
      (!section || i.section === section) &&
      `${i.itemRef} ${i.description}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-3 pt-4">
      <label>
        {t("search")}
        <input
          className={inputStyle}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <label>
        {t("section")}
        <select
          className={inputStyle}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="">{t("all")}</option>
          {[...new Set(query.data?.map((i) => i.section).filter(Boolean))].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      {query.isPending && <Skeleton className="h-96 w-full" />}
      {query.isError && <ErrorState message={t("error")} />}
      {query.data && rows.length === 0 && <EmptyState message={t("noItems")} />}
      {rows.length > 0 && (
        <VirtualTable
          label={t("items")}
          rows={rows}
          columns="120px minmax(240px,2fr) 90px 130px 140px 160px"
          header={mappingFields.slice(0, 6).map((f) => (
            <div role="columnheader" key={f} className="p-2">
              {t(`fields.${f}`)}
            </div>
          ))}
          renderRow={(item) => (
            <>
              {[
                item.itemRef,
                item.description,
                item.unit,
                item.quantity,
                item.rate,
                item.amount,
              ].map((v, i) => (
                <div
                  role="cell"
                  className={`truncate border-b border-line px-2 py-2 ${i >= 3 ? "text-right" : ""}`}
                  key={i}
                >
                  {typeof v === "number" && i >= 4
                    ? i === 4
                      ? formatUnitRate(v, item.unit)
                      : formatCurrency(v)
                    : (v ?? "—")}
                </div>
              ))}
            </>
          )}
        />
      )}
    </div>
  );
}
