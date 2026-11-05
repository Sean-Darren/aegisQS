import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/^page-.*\.js$/.test(e.name)) files.push(p);
  }
}
walk(".next/static/chunks/app");
const size = (p) => (gzipSync(fs.readFileSync(p)).length / 1024).toFixed(1);
let out =
  "# Production bundle inspection\n\nGzip KiB, measured with Node zlib after `npm run build`. Route entries exclude shared framework/runtime chunks and deferred imports: these are **not** total first-load sizes.\n\n| Route entry | Gzip KiB |\n|---|---:|\n";
for (const f of files.sort())
  out += `| ${path.dirname(f).replace(".next/static/chunks/app", "") || "/"} | ${size(f)} |\n`;
out +=
  "\n## Deferred modules\n\nThe webpack loadable manifest confirms separate chunks for the following modules. Figures sum each module’s listed JS chunks; shared chunks can occur in several rows.\n\n| Module | Gzip KiB |\n|---|---:|\n";
for (const [module, entry] of Object.entries(
  JSON.parse(fs.readFileSync(".next/react-loadable-manifest.json")),
))
  if (
    /fan-chart|exposure-chart|version-totals-chart|pdf-canvas|comparison-canvas|exceljs|\.\/browser/.test(
      module,
    )
  ) {
    out += `| ${module.replaceAll("|", "/")} | ${entry.files
      .filter((f) => f.endsWith(".js"))
      .reduce((n, f) => n + Number(size(path.join(".next", f))), 0)
      .toFixed(1)} |\n`;
  }
out +=
  "\nPDF worker assets are loaded by PDF.js on viewer demand. Mock fixture/file bytes and ExcelJS are mock-only deferred costs; disable mocking for the real API. No route-size budget is specified in AGENTS.md.\n";
fs.writeFileSync("docs/bundle-report.md", out);
