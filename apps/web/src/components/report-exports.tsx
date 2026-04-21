"use client";

import type { ReportPdfProps } from "./report-pdf";
import { Btn } from "./kit";
import { Ic } from "./icons";
import { theme } from "~/lib/theme";
import { downloadCsv } from "~/lib/csv";
import { downloadReportPdf } from "~/lib/pdf";

export interface CsvColumn<T> {
  key: keyof T & string;
  header: string;
  format?: (value: T[keyof T], row: T) => string;
}

/**
 * CSV + PDF export buttons for a report page. Both buttons are always
 * clickable (empty data yields header-only CSV / "no data" PDF page)
 * so operators can confirm a run even if nothing matched the filters.
 *
 * The PDF path lazy-imports @react-pdf/renderer and the ReportPDF
 * component so those ~500kB of code don't ship in the initial bundle.
 */
export function ReportExports<T extends Record<string, unknown>>({
  baseName,
  rows,
  csvColumns,
  pdfProps,
}: {
  baseName: string;
  rows: T[];
  csvColumns: CsvColumn<T>[];
  /** Everything ReportPDF needs except rows (we pass rows separately). */
  pdfProps: () => Omit<ReportPdfProps<T>, "rows">;
}) {
  const t = theme;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <Btn
        t={t}
        variant="secondary"
        size="sm"
        icon={Ic.Download}
        onClick={() => downloadCsv(`${baseName}-${today}.csv`, rows, csvColumns)}
      >
        CSV
      </Btn>
      <Btn
        t={t}
        variant="secondary"
        size="sm"
        icon={Ic.Download}
        onClick={() =>
          downloadReportPdf(`${baseName}-${today}.pdf`, { ...pdfProps(), rows })
        }
      >
        PDF
      </Btn>
    </div>
  );
}
