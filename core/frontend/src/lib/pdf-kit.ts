// Shared jsPDF primitives: A4 geometry, the document palette, WinAnsi-safe text
// and the table/footer helpers the report builders draw with.

export type Doc = InstanceType<Awaited<typeof import("jspdf")>["jsPDF"]>;
export type AutoTable = Awaited<typeof import("jspdf-autotable")>["autoTable"];
export type TableOpts = Parameters<AutoTable>[1];
export type Cell = string | number;
export type Rgb = [number, number, number];

// A4 portrait, millimetres.
export const MARGIN = 14;
export const PAGE_W = 210;
export const PAGE_H = 297;
export const CONTENT_W = PAGE_W - MARGIN * 2;

export const INK: Rgb = [15, 23, 42];
export const MUTED: Rgb = [71, 85, 105];
export const RULE: Rgb = [203, 213, 225];
export const ZEBRA: Rgb = [248, 250, 252];

/**
 * jsPDF's built-in Helvetica is WinAnsi-encoded, so anything outside that range
 * renders as mojibake — the "→" in window labels came out as "!'". Map the
 * typographic characters the app emits and drop anything else out of range,
 * since hull IDs and model names are not guaranteed to be Latin-1.
 */
export function pdfSafe(value: string): string {
  return value
    .replace(/→/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\xFF]/g, "?");
}

const safeRows = (rows?: Cell[][]) =>
  rows?.map((row) => row.map((cell) => (typeof cell === "string" ? pdfSafe(cell) : cell)));

/** Right-align every column from `first` onwards (numeric table bodies). */
export function numericFrom(first: number, count = 6): NonNullable<TableOpts["columnStyles"]> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => i + first).map((i) => [i, { halign: "right" as const }]),
  );
}

export interface TableSpec {
  head: Cell[][];
  body: Cell[][];
  foot?: Cell[][];
  columnStyles?: TableOpts["columnStyles"];
}

/** A titled table in the document style; returns the Y cursor below it. */
export function titledTable(
  doc: Doc, autoTable: AutoTable, y: number, title: string, spec: TableSpec,
): number {
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...MUTED);
  doc.text(pdfSafe(title.toUpperCase()), MARGIN, y);

  autoTable(doc, {
    head: safeRows(spec.head),
    body: safeRows(spec.body),
    foot: safeRows(spec.foot),
    columnStyles: spec.columnStyles,
    startY: y + 2.5,
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 8 },
    theme: "grid",
    styles: {
      font: "helvetica", fontSize: 8, cellPadding: 1.6,
      lineColor: RULE, lineWidth: 0.15, textColor: INK,
    },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
    footStyles: { fillColor: ZEBRA, textColor: INK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ZEBRA },
    rowPageBreak: "avoid",
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
}

/** "Page X of Y" plus a caption on every page — added once the count is known. */
export function stampPageFooters(doc: Doc, caption: string): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text(pdfSafe(caption), MARGIN, PAGE_H - 8);
    doc.text(`Page ${page} of ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }
}
