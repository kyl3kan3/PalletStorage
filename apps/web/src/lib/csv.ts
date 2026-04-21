/**
 * Minimal client-side CSV download. Good enough for operational reports
 * where rows are under ~50k. Uses the browser's BOM-prefixed UTF-8 so
 * Excel opens the file with the right encoding.
 */
export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: Array<{ key: keyof T; header: string; format?: (v: T[keyof T], row: T) => string }>,
): void {
  const lines: string[] = [columns.map((c) => escape(c.header)).join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const raw = row[c.key];
          const value = c.format ? c.format(raw, row) : stringify(raw);
          return escape(value);
        })
        .join(","),
    );
  }
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escape(s: string): string {
  if (s == null) return "";
  const needsQuote = /[",\n\r]/.test(s);
  const body = s.replace(/"/g, '""');
  return needsQuote ? `"${body}"` : body;
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
