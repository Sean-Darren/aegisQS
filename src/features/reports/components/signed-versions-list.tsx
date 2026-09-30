"use client";
import { useLocale, useTranslations } from "next-intl";
import { Download, Link2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { formatDate, type FormatLocale } from "@/lib/format";
import type { Report, User } from "@/schemas";

export function SignedVersionsList({
  reports,
  user,
  signatoryNames,
  sharedLink,
  onDownload,
  onShare,
  onCopy,
}: {
  reports: Report[];
  user?: User;
  signatoryNames: Record<string, string>;
  sharedLink?: { reportId: string; url: string; expiresAt: string };
  onDownload: (report: Report) => void;
  onShare: (report: Report) => void;
  onCopy: (url: string) => void;
}) {
  const t = useTranslations("Reports");
  const locale = useLocale() as FormatLocale;
  const signed = reports
    .filter((report) => report.status === "signed")
    .sort((a, b) => b.version - a.version);
  return (
    <section
      aria-labelledby="signed-versions-title"
      className="rounded-lg border border-line bg-panel p-5"
    >
      <h2 id="signed-versions-title" className="text-lg font-semibold text-ink">
        {t("signedVersions")}
      </h2>
      {signed.length === 0 ? (
        <p className="mt-3 text-sm text-muted-ink">{t("noSignedVersions")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {signed.map((report) => (
            <li key={report.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="num font-semibold text-ink">
                    {t("version", { version: report.version })}
                  </p>
                  <p className="mt-1 text-sm text-muted-ink">
                    {t("signedByOn", {
                      name:
                        signatoryNames[report.signedBy ?? ""] ??
                        report.signedBy ??
                        t("notSigned"),
                      date: report.signedAt
                        ? formatDate(report.signedAt, locale)
                        : t("notSigned"),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(report)}
                  >
                    <Download aria-hidden="true" />
                    {t("downloadPdf")}
                  </Button>
                  {can(user, "report.share") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onShare(report)}
                    >
                      <Link2 aria-hidden="true" />
                      {t("shareWithOwners")}
                    </Button>
                  )}
                </div>
              </div>
              {sharedLink?.reportId === report.id && (
                <div className="mt-3 rounded-md border border-line bg-stone-50 p-3">
                  <label
                    className="block text-sm font-medium text-ink"
                    htmlFor={`share-link-${report.id}`}
                  >
                    {t("shareLink")}
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      id={`share-link-${report.id}`}
                      readOnly
                      value={sharedLink.url}
                      className="min-w-0 flex-1 rounded-md border border-line-strong bg-panel px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCopy(sharedLink.url)}
                    >
                      <Copy aria-hidden="true" />
                      {t("copyLink")}
                    </Button>
                  </div>
                  <p className="num mt-2 text-xs text-muted-ink">
                    {t("linkExpires", {
                      date: formatDate(sharedLink.expiresAt, locale),
                    })}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
