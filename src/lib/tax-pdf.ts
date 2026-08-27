import jsPDF from "jspdf";

const MARGIN = 40;

async function loadImage(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
}

export type ReceiptEntry = { title: string; date: string; url: string };

/** Merge every EFD receipt photo into one PDF, ordered by date. */
export async function buildEfdReceiptsPdf(entries: ReceiptEntry[], fileName: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(20);
  doc.text("EFD Receipts", MARGIN, 70);
  doc.setFontSize(11);
  doc.text(`${entries.length} receipt(s) · generated ${new Date().toLocaleDateString("en-GB")}`, MARGIN, 92);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let y = 124;
  sorted.forEach((entry, index) => {
    if (y > pageHeight - MARGIN) { doc.addPage(); y = MARGIN + 20; }
    doc.text(`${index + 1}. ${entry.date} — ${entry.title}`.slice(0, 95), MARGIN, y);
    y += 18;
  });

  for (const entry of sorted) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text(`${entry.date} — ${entry.title}`.slice(0, 90), MARGIN, 50);
    try {
      const image = await loadImage(entry.url);
      const maxW = pageWidth - MARGIN * 2;
      const maxH = pageHeight - 100;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      doc.addImage(image.dataUrl, "JPEG", MARGIN, 70, image.width * scale, image.height * scale);
    } catch {
      doc.setFontSize(10);
      doc.text("Receipt file could not be embedded.", MARGIN, 80);
    }
  }

  doc.save(fileName);
}

export type ReportSection = { title: string; rows: [string, string][] };

/** One consolidated Tax Management report. */
export function buildTaxReportPdf(sections: ReportSection[], fileName: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 70;

  doc.setFontSize(20);
  doc.text("Tax Management Report", MARGIN, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, MARGIN, y);
  y += 26;

  for (const section of sections) {
    if (y > pageHeight - 120) { doc.addPage(); y = 70; }
    doc.setFontSize(13);
    doc.text(section.title, MARGIN, y);
    y += 8;
    doc.setDrawColor(200);
    doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN, y);
    y += 16;
    doc.setFontSize(10);
    for (const [label, value] of section.rows) {
      if (y > pageHeight - MARGIN) { doc.addPage(); y = 70; }
      doc.text(label, MARGIN, y);
      doc.text(value, doc.internal.pageSize.getWidth() - MARGIN, y, { align: "right" });
      y += 16;
    }
    y += 14;
  }

  doc.save(fileName);
}
