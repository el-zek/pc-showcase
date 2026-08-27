import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export type ReportPayload = {
  filename: string;
  title: string;
  subtitle?: string;
  summary?: [string, string][];
  headers: string[];
  rows: (string | number)[][];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportReportCsv(payload: ReportPayload) {
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines: string[] = [payload.title];
  if (payload.subtitle) lines.push(payload.subtitle);
  if (payload.summary?.length) {
    lines.push("");
    payload.summary.forEach(([label, value]) => lines.push(`${escape(label)},${escape(value)}`));
  }
  lines.push("");
  lines.push(payload.headers.map(escape).join(","));
  payload.rows.forEach((row) => lines.push(row.map(escape).join(",")));
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${payload.filename}.csv`);
}

export function exportReportExcel(payload: ReportPayload) {
  const aoa: (string | number)[][] = [[payload.title]];
  if (payload.subtitle) aoa.push([payload.subtitle]);
  if (payload.summary?.length) {
    aoa.push([]);
    payload.summary.forEach(([label, value]) => aoa.push([label, value]));
  }
  aoa.push([]);
  aoa.push(payload.headers);
  payload.rows.forEach((row) => aoa.push(row));
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = payload.headers.map(() => ({ wch: 22 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Report");
  const data = XLSX.write(book, { bookType: "xlsx", type: "array" });
  download(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${payload.filename}.xlsx`);
}

export function exportReportPdf(payload: ReportPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  doc.setFillColor(17, 17, 20);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(payload.title, margin, 46);
  doc.setFontSize(10);
  doc.setTextColor(240, 190, 80);
  doc.text(payload.subtitle ?? `Generated ${new Date().toLocaleString("en-GB")}`, margin, 68);

  let y = 126;
  doc.setTextColor(30, 30, 30);

  if (payload.summary?.length) {
    doc.setFontSize(13);
    doc.text("Summary", margin, y);
    y += 18;
    doc.setFontSize(10);
    payload.summary.forEach(([label, value]) => {
      if (y > pageHeight - margin) { doc.addPage(); y = margin + 20; }
      doc.setTextColor(90, 90, 90);
      doc.text(String(label), margin, y);
      doc.setTextColor(20, 20, 20);
      doc.text(String(value), pageWidth - margin, y, { align: "right" });
      y += 16;
    });
    y += 14;
  }

  const usable = pageWidth - margin * 2;
  const colWidth = usable / Math.max(payload.headers.length, 1);

  const drawHead = () => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 12, usable, 20, "F");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    payload.headers.forEach((header, index) => {
      doc.text(String(header).slice(0, 22), margin + 4 + colWidth * index, y + 2);
    });
    y += 22;
  };

  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("Details", margin, y);
  y += 22;
  drawHead();

  doc.setFontSize(9);
  payload.rows.forEach((row) => {
    if (y > pageHeight - margin) { doc.addPage(); y = margin + 20; drawHead(); }
    doc.setTextColor(35, 35, 35);
    row.forEach((cell, index) => {
      doc.text(String(cell ?? "").slice(0, 24), margin + 4 + colWidth * index, y);
    });
    y += 16;
  });

  if (!payload.rows.length) {
    doc.setTextColor(120, 120, 120);
    doc.text("No records for this period.", margin, y);
  }

  doc.save(`${payload.filename}.pdf`);
}
