/** Shared UTF-8/BOM CSV serialization, including quoted delimiters and newlines. */
export function rowsCsv(headings: string[], rows: string[][]) {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return `\uFEFF${[headings, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
