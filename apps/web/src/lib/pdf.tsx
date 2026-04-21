"use client";

import type { ReportPdfProps } from "~/components/report-pdf";

/**
 * Lazy PDF generator: dynamically imports both the @react-pdf/renderer
 * runtime and our ReportPDF component inside the click handler, so
 * their ~500kB footprint never lands in the initial report-page bundle.
 */
export async function downloadReportPdf<T extends Record<string, unknown>>(
  filename: string,
  props: ReportPdfProps<T>,
): Promise<void> {
  const [{ pdf }, { ReportPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("~/components/report-pdf"),
  ]);
  const blob = await pdf(<ReportPDF {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
