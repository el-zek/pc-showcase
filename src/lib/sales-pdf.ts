import jsPDF from "jspdf";

const MARGIN = 40;
const AMBER = [217, 160, 40] as const;
const DARK = [24, 26, 32] as const;

export type PdfLine = {
  name: string;
  spec?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PdfDocument = {
  kind: "INVOICE" | "QUOTATION";
  number: string;
  date: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  business: { name: string; address?: string; phone?: string };
  customer: { name: string; phone?: string; address?: string };
  lines: PdfLine[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid?: number;
  notes?: string;
  footer?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value || 0));

/** Build a clean, modern invoice / quotation PDF and download it. */
export function buildSalesDocumentPdf(data: PdfDocument, fileName: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const right = pageWidth - MARGIN;

  /* header band */
  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(0, 0, pageWidth, 110, "F");
  doc.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
  doc.rect(0, 110, pageWidth, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(data.business.name || "Business", MARGIN, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const bizLines = [data.business.address, data.business.phone].filter(Boolean) as string[];
  bizLines.forEach((line, index) => doc.text(line, MARGIN, 70 + index * 12));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
  doc.text(data.kind, right, 52, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${data.number}`, right, 70, { align: "right" });
  doc.text(`Date: ${data.date}`, right, 84, { align: "right" });
  if (data.secondaryLabel && data.secondaryValue) {
    doc.text(`${data.secondaryLabel}: ${data.secondaryValue}`, right, 98, { align: "right" });
  }

  /* customer block */
  let y = 150;
  doc.setTextColor(120, 120, 130);
  doc.setFontSize(8);
  doc.text(data.kind === "INVOICE" ? "BILL TO" : "PREPARED FOR", MARGIN, y);
  doc.setTextColor(30, 30, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(data.customer.name || "Walk-in customer", MARGIN, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 100);
  const custLines = [data.customer.phone, data.customer.address].filter(Boolean) as string[];
  custLines.forEach((line, index) => doc.text(line, MARGIN, y + 32 + index * 12));

  y = y + 44 + custLines.length * 12;

  /* table head */
  const colQty = right - 210;
  const colPrice = right - 130;
  const colTotal = right;

  doc.setFillColor(245, 245, 247);
  doc.rect(MARGIN, y, pageWidth - MARGIN * 2, 24, "F");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text("ITEM", MARGIN + 8, y + 16);
  doc.text("QTY", colQty, y + 16, { align: "right" });
  doc.text("PRICE", colPrice, y + 16, { align: "right" });
  doc.text("TOTAL", colTotal - 8, y + 16, { align: "right" });
  y += 24;

  /* rows */
  doc.setTextColor(35, 35, 40);
  data.lines.forEach((line) => {
    if (y > pageHeight - 200) {
      doc.addPage();
      y = MARGIN;
    }
    const specLines = line.spec ? doc.splitTextToSize(line.spec, colQty - MARGIN - 30) : [];
    const rowHeight = 22 + specLines.length * 11;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(line.name, colQty - MARGIN - 30)[0] ?? line.name, MARGIN + 8, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(String(line.quantity), colQty, y + 15, { align: "right" });
    doc.text(money(line.unitPrice), colPrice, y + 15, { align: "right" });
    doc.text(money(line.lineTotal), colTotal - 8, y + 15, { align: "right" });
    if (specLines.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      specLines.forEach((spec: string, index: number) => doc.text(spec, MARGIN + 8, y + 27 + index * 11));
      doc.setTextColor(35, 35, 40);
    }
    y += rowHeight;
    doc.setDrawColor(232, 232, 236);
    doc.line(MARGIN, y, right, y);
  });

  /* totals */
  y += 18;
  const totals: [string, string][] = [
    ["Subtotal", money(data.subtotal)],
    ["Tax", money(data.taxAmount)],
  ];
  if (data.discountAmount) totals.push(["Discount", `- ${money(data.discountAmount)}`]);
  doc.setFontSize(10);
  totals.forEach(([label, value]) => {
    doc.setTextColor(110, 110, 120);
    doc.text(label, colPrice, y, { align: "right" });
    doc.setTextColor(35, 35, 40);
    doc.text(value, colTotal - 8, y, { align: "right" });
    y += 16;
  });

  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(colPrice - 90, y - 2, right - (colPrice - 90), 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", colPrice, y + 18, { align: "right" });
  doc.setTextColor(AMBER[0], AMBER[1], AMBER[2]);
  doc.text(`TZS ${money(data.total)}`, colTotal - 8, y + 18, { align: "right" });
  y += 42;

  if (typeof data.amountPaid === "number") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 100);
    doc.text(`Paid: TZS ${money(data.amountPaid)}`, colPrice, y, { align: "right" });
    doc.text(`Balance: TZS ${money(Math.max(0, data.total - data.amountPaid))}`, colTotal - 8, y + 14, { align: "right" });
    y += 32;
  }

  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 120);
    doc.text("NOTES", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    doc.text(doc.splitTextToSize(data.notes, pageWidth - MARGIN * 2), MARGIN, y + 14);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 160);
  doc.text(
    data.footer ?? (data.kind === "INVOICE" ? "Thank you for your business." : "This quotation is valid until the date shown above."),
    pageWidth / 2,
    pageHeight - 30,
    { align: "center" },
  );

  doc.save(fileName);
}
