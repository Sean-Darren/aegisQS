"use client";
import { useEffect, useState } from "react";
import { translator } from "../src/copy";
import type {
  User,
  Project,
  Workbook,
  WorkbookCheck,
  WorkbookVersion,
} from "@schemas";
import { can } from "@/lib/auth/permissions";
import { api } from "../src/api";
import {
  ready,
  signIn,
  exportWorkbook,
  selectCell,
  readWorkbookIdentity,
} from "../src/office";
type VersionState =
  | "UNKNOWN"
  | "UNVERIFIED"
  | "CURRENT"
  | "OUTDATED"
  | "AHEAD"
  | "MISMATCH"
  | "ERROR";
const versionStatusKey = {
  UNKNOWN: "statusUnknown",
  UNVERIFIED: "statusUnverified",
  CURRENT: "statusCurrent",
  OUTDATED: "statusOutdated",
  AHEAD: "statusAhead",
  MISMATCH: "statusMismatch",
  ERROR: "statusError",
} satisfies Record<VersionState, Parameters<ReturnType<typeof translator>>[0]>;
function resolveVersionState(
  open: string,
  latest?: WorkbookVersion,
): VersionState {
  if (!latest) return "ERROR";
  const raw = open.trim();
  if (!raw) return "UNVERIFIED";
  const versionNumber = Number(raw);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) return "UNKNOWN";
  if (versionNumber === latest.versionNumber) return "CURRENT";
  if (versionNumber < latest.versionNumber) return "OUTDATED";
  if (versionNumber > latest.versionNumber) return "AHEAD";
  return "MISMATCH";
}
export default function TaskPane() {
  const [locale, setLocale] = useState<"en" | "zh-HK">("en");
  const t = translator(locale);
  const [host, setHost] = useState("");
  const [user, setUser] = useState<User>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState("");
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [workbook, setWorkbook] = useState("");
  const [checks, setChecks] = useState<WorkbookCheck[]>([]);
  const [current, setCurrent] = useState<WorkbookVersion>();
  const [checkedVersion, setCheckedVersion] = useState<WorkbookVersion>();
  const [openNumber, setOpenNumber] = useState("");
  const [copy, setCopy] = useState<File>();
  const [confirmedCopy, setConfirmedCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = workbooks.find((w) => w.id === workbook);
  const selectedProject = projects.find((p) => p.id === project);
  const canUpload = can(user, "workbook.upload");
  const versionState = resolveVersionState(openNumber, current);
  const selectionVerified =
    versionState === "CURRENT" && checkedVersion?.id === current?.id;
  useEffect(() => {
    let active = true;
    void ready()
      .then(async (info) => {
        if (!active) return;
        setHost(info.platform);
        try {
          const existing = await api.me();
          const list = await api.projects();
          if (active) {
            setUser(existing);
            setProjects(list);
          }
        } catch {
          /* An anonymous pane signs in through the dialog. */
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function authenticate() {
    await signIn(locale);
    setUser(await api.me());
    setProjects(await api.projects());
  }
  async function pickProject(id: string) {
    setProject(id);
    setWorkbook("");
    setChecks([]);
    setCurrent(undefined);
    setCheckedVersion(undefined);
    setOpenNumber("");
    setWorkbooks(await api.workbooks(id));
  }
  async function pickWorkbook(id: string) {
    setWorkbook(id);
    setChecks([]);
    setCurrent(undefined);
    setCheckedVersion(undefined);
    setOpenNumber("");
    setCopy(undefined);
    setConfirmedCopy(false);
    const w = workbooks.find((w) => w.id === id);
    if (w?.currentVersionId) setCurrent(await api.version(w.currentVersionId));
    const identity = await readWorkbookIdentity();
    if (identity?.workbookId === id && identity.versionNumber) {
      setOpenNumber(String(identity.versionNumber));
    }
  }
  async function refresh() {
    const list = await api.workbooks(project);
    setWorkbooks(list);
    const w = list.find((w) => w.id === workbook);
    if (!w?.currentVersionId)
      throw new Error("No saved version yet. Save a workbook version first.");
    const v = await api.version(w.currentVersionId);
    setCurrent(v);
    return v;
  }
  async function save() {
    if (!selected) throw new Error("Choose a workbook.");
    const file = host === "OfficeOnline" ? copy : await exportWorkbook();
    if (!file)
      throw new Error(
        "Download a copy from Excel and choose the matching .xlsx file first.",
      );
    const version = await api.save(selected.id, file);
    setOpenNumber(String(version.versionNumber));
    setCurrent(version);
    setChecks([]);
    setCheckedVersion(undefined);
    setCopy(undefined);
    setConfirmedCopy(false);
    await refresh();
    setNotice(t("saved", { version: version.versionNumber }));
  }
  async function check() {
    const v = await refresh();
    setCheckedVersion(v);
    setChecks(await api.checks(v.id));
    setNotice(
      v.status === "checked"
        ? t("checksReady")
        : t("checksPending", { version: v.versionNumber, status: v.status }),
    );
  }
  async function checkVersion() {
    await refresh();
    setNotice(t("versionChecked"));
  }
  return (
    <main lang={locale}>
      <label>
        {t("language")}
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as "en" | "zh-HK")}
        >
          <option value="en">English</option>
          <option value="zh-HK">繁體中文</option>
        </select>
      </label>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <p role="status" aria-live="polite">
        {busy ? t("working") : notice}
      </p>
      {error && (
        <div role="alert" className="error">
          {t("failed")}
          <details>
            <summary>{t("details")}</summary>
            {error}
          </details>
        </div>
      )}
      {
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!document.requestStorageAccess)
                throw new Error(
                  "Use your browser settings to allow cookies for Smart QS.",
                );
              await document.requestStorageAccess();
              setUser(await api.me());
              setProjects(await api.projects());
            })
          }
        >
          {t("cookies")}
        </button>
      }
      <button disabled={!host || busy} onClick={() => void run(authenticate)}>
        {t("signIn")}
      </button>
      {user && (
        <>
          <p>{user.name}</p>
          <fieldset disabled={busy}>
            <legend>{t("connection")}</legend>
            <label>
              {t("project")}
              <select
                value={project}
                onChange={(e) => void run(() => pickProject(e.target.value))}
              >
                <option value="">{t("chooseProject")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("workbook")}
              <select
                value={workbook}
                onChange={(e) => void run(() => pickWorkbook(e.target.value))}
              >
                <option value="">{t("chooseWorkbook")}</option>
                {workbooks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            {project && workbooks.length === 0 && <p>{t("empty")}</p>}
            <label>
              {t("openVersion")}
              <input
                type="number"
                min="1"
                step="1"
                value={openNumber}
                onChange={(e) => setOpenNumber(e.target.value)}
              />
            </label>
          </fieldset>
          {selected && (
            <>
              <section aria-live="polite">
                <h2>{t("versionStatusTitle")}</h2>
                <dl>
                  <div>
                    <dt>{t("project")}</dt>
                    <dd>{selectedProject?.name}</dd>
                  </div>
                  <div>
                    <dt>{t("workbook")}</dt>
                    <dd>{selected.name}</dd>
                  </div>
                  <div>
                    <dt>{t("open")}</dt>
                    <dd>
                      {openNumber.trim() ? `v${openNumber.trim()}` : t("notVerified")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("latest")}</dt>
                    <dd>
                      {current ? `v${current.versionNumber}` : t("notUploaded")}
                    </dd>
                  </div>
                </dl>
                <p className={versionState === "CURRENT" ? "success" : "warning"}>
                  {t(versionStatusKey[versionState])}
                </p>
              </section>
              <section>
                <h2>{t("versions")}</h2>
                <p>
                  {t("current")} {current?.versionNumber ?? t("notUploaded")}
                </p>
                {host === "OfficeOnline" && canUpload && (
                  <>
                    <p className="warning">{t("fallback")}</p>
                    <label>
                      {t("copy")}
                      <input
                        key={`${workbook}:${current?.id ?? ""}`}
                        type="file"
                        accept=".xlsx,.xlsm"
                        disabled={busy}
                        onChange={(e) => {
                          setCopy(e.target.files?.[0]);
                          setConfirmedCopy(false);
                        }}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={confirmedCopy}
                        onChange={(e) => setConfirmedCopy(e.target.checked)}
                      />
                      {t("confirmCopy")}
                    </label>
                  </>
                )}
                <button disabled={busy} onClick={() => void run(checkVersion)}>
                  {t("checkVersion")}
                </button>
                {current && (
                  <p>
                    <a
                      href={`/api/v1/workbook-versions/${encodeURIComponent(current.id)}/download?annotated=false`}
                      download={current.fileName}
                    >
                      {t("download")}
                    </a>
                  </p>
                )}
                {canUpload && (
                  <button
                    disabled={
                      busy ||
                      (host === "OfficeOnline" && (!copy || !confirmedCopy))
                    }
                    onClick={() => void run(save)}
                  >
                    {t("save")}
                  </button>
                )}
              </section>
              <section>
                <h2>{t("checks")}</h2>
                <p>{t("checkBasis")}</p>
                <button disabled={busy} onClick={() => void run(check)}>
                  {t("check")}
                </button>
                {checks.length === 0 && <p>{t("noChecks")}</p>}
                {checkedVersion && checks.length > 0 && (
                  <p className={selectionVerified ? "success" : "warning"}>
                    {selectionVerified
                      ? t("checksReadyCurrent", { count: checks.length })
                      : t("checksReadyCloudOnly", { count: checks.length })}
                  </p>
                )}
                {!selectionVerified && (
                  <p className="warning">{t("verifyVersion")}</p>
                )}
                {checks.map((c) => (
                  <button
                    className="check"
                    key={c.id}
                    disabled={busy || !selectionVerified}
                    onClick={() => void run(() => selectCell(c.sheet, c.cell))}
                  >
                    {c.severity} · {c.sheet}!{c.cell} · {c.message} · {c.status}
                  </button>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
