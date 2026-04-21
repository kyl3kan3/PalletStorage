"use client";

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export interface ReportPdfColumn<T> {
  key: keyof T & string;
  header: string;
  align?: "left" | "right";
  width?: number; // percent; if omitted, equal width
  format?: (value: T[keyof T], row: T) => string;
}

export interface ReportPdfProps<T extends Record<string, unknown>> {
  title: string;
  subtitle?: string;
  organizationName?: string;
  dateRange?: { from?: Date; to?: Date };
  columns: ReportPdfColumn<T>[];
  rows: T[];
  footerNotes?: string[];
}

/**
 * Generic tabular report PDF. One page of header (company + title +
 * date range) and a table of rows; paginates automatically via
 * @react-pdf/renderer's flow layout. Kept generic on purpose — every
 * report hits /api/... or client-side renders the same shape.
 */
export function ReportPDF<T extends Record<string, unknown>>({
  title,
  subtitle,
  organizationName,
  dateRange,
  columns,
  rows,
  footerNotes,
}: ReportPdfProps<T>) {
  const colCount = columns.length;
  const widths = columns.map((c) => c.width ?? 100 / colCount);

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={{ flex: 1 }}>
            {organizationName && (
              <Text style={styles.orgName}>{organizationName}</Text>
            )}
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{new Date().toLocaleString()}</Text>
            {dateRange && (dateRange.from || dateRange.to) && (
              <>
                <Text style={styles.metaLabel}>Window</Text>
                <Text style={styles.metaValue}>
                  {dateRange.from ? dateRange.from.toLocaleDateString() : "—"}
                  {" → "}
                  {dateRange.to ? dateRange.to.toLocaleDateString() : "—"}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader} fixed>
          {columns.map((c, i) => (
            <Text
              key={c.key}
              style={[
                styles.th,
                {
                  width: `${widths[i]}%`,
                  textAlign: c.align ?? "left",
                },
              ]}
            >
              {c.header}
            </Text>
          ))}
        </View>

        {/* Rows */}
        {rows.length === 0 ? (
          <Text style={styles.empty}>No data for this report.</Text>
        ) : (
          rows.map((row, ri) => (
            <View
              key={ri}
              style={ri % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}
            >
              {columns.map((c, ci) => {
                const raw = row[c.key];
                const value = c.format ? c.format(raw, row) : stringify(raw);
                return (
                  <Text
                    key={c.key}
                    style={[
                      styles.td,
                      {
                        width: `${widths[ci]}%`,
                        textAlign: c.align ?? "left",
                      },
                    ]}
                  >
                    {value}
                  </Text>
                );
              })}
            </View>
          ))
        )}

        {footerNotes && footerNotes.length > 0 && (
          <View style={styles.footer}>
            {footerNotes.map((n, i) => (
              <Text key={i} style={styles.footerNote}>
                {n}
              </Text>
            ))}
          </View>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString();
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#1F1A17",
    paddingBottom: 10,
    marginBottom: 14,
  },
  orgName: { fontSize: 10, color: "#5A4F46", marginBottom: 2 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1F1A17" },
  subtitle: { fontSize: 10, color: "#5A4F46", marginTop: 2 },
  meta: { minWidth: 140 },
  metaLabel: {
    fontSize: 8,
    color: "#8B7F73",
    textTransform: "uppercase",
    marginTop: 4,
  },
  metaValue: { fontSize: 10, color: "#1F1A17", fontFamily: "Courier" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3ECDD",
    borderBottomWidth: 1,
    borderColor: "#1F1A17",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: {
    fontSize: 8,
    color: "#5A4F46",
    textTransform: "uppercase",
    fontWeight: "bold",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#C9BFB3",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  rowAlt: { backgroundColor: "#FAF6EE" },
  td: { fontSize: 9, color: "#2E2824" },
  empty: {
    fontSize: 11,
    color: "#8B7F73",
    textAlign: "center",
    paddingVertical: 24,
  },
  footer: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderColor: "#C9BFB3",
  },
  footerNote: { fontSize: 9, color: "#5A4F46", marginBottom: 2 },
  pageNumber: {
    position: "absolute",
    bottom: 18,
    right: 32,
    fontSize: 9,
    color: "#8B7F73",
    fontFamily: "Courier",
  },
});
