import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { DocumentDialog, emptyDraft, type DocumentDraft } from "@/components/sales/document-dialog";
import { productSpec } from "@/components/sales/line-items-editor";
import { docNumber, formatMoney, lineTotals, useSales, type QuotationRecord } from "@/components/sales/sales-provider";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { buildSalesDocumentPdf } from "@/lib/sales-pdf";

export const Route = createFileRoute("/_authenticated/m/sales/quotations")({ component: QuotationsPage });

function QuotationsPage() {
  const business = useBusinessProfile();
  const { quotations, quotationItems, products, customers, saveQuotation, deleteQuotation, setQuotationStatus, convertQuotation, metrics } = useSales();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationRecord | null>(null);
  const [detail, setDetail] = useState<QuotationRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuotationRecord | null>(null);

  const itemsOf = (id: string) => quotationItems.filter((item) => item.quotationId === id);

  const draftFor = (row: QuotationRecord | null): DocumentDraft =>
    row
      ? {
          customerId: row.customerId,
          customerName: row.customerName,
          date: row.quoteDate,
          secondDate: row.validUntil,
          discountAmount: row.discountAmount,
          notes: row.notes,
          status: row.status,
          items: itemsOf(row.id).map(({ productId, productName, quantity, unitPrice, taxAmount, lineTotal }) => ({ productId, productName, quantity, unitPrice, taxAmount, lineTotal })),
        }
      : emptyDraft("Draft");

  const submit = (draft: DocumentDraft) => {
    const totals = lineTotals(draft.items, draft.discountAmount);
    void saveQuotation(
      {
        quoteNo: editing?.quoteNo ?? docNumber("QTN"),
        customerId: draft.customerId,
        customerName: draft.customerName || "Walk-in customer",
        quoteDate: draft.date,
        validUntil: draft.secondDate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: draft.discountAmount,
        total: totals.total,
        notes: draft.notes,
        status: draft.status as QuotationRecord["status"],
      },
      draft.items,
      editing?.id,
    ).then(() => {
      toast.success(editing ? "Quotation updated" : "Quotation created — stock untouched");
      setFormOpen(false);
    });
  };

  const download = (row: QuotationRecord) => {
    const customer = customers.find((c) => c.id === row.customerId);
    buildSalesDocumentPdf(
      {
        kind: "QUOTATION",
        number: row.quoteNo,
        date: row.quoteDate,
        secondaryLabel: "Valid until",
        secondaryValue: row.validUntil || "—",
        business,
        customer: { name: row.customerName, phone: customer?.phone, address: customer?.address },
        lines: itemsOf(row.id).map((item) => {
          const product = products.find((p) => p.id === item.productId);
          return { name: item.productName, spec: product ? productSpec(product) : "", quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal };
        }),
        subtotal: row.subtotal,
        taxAmount: row.taxAmount,
        discountAmount: row.discountAmount,
        total: row.total,
        notes: row.notes,
      },
      `${row.quoteNo}.pdf`,
    );
    toast.success("Quotation PDF generated");
  };

  return (
    <TaxWorkspace
      title="Quotations"
      subtitle="Price offers for customers — stock stays untouched"
      icon={FileText}
      backTo="/m/sales"
      backLabel="Back to Sales"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={() => { setEditing(null); setFormOpen(true); }}>
          New quotation
        </Button>
      }
    >
      <SummaryStrip items={[{ label: "Quoted value", value: formatMoney(metrics.quotationTotal), hint: `${metrics.quotationCount} quotations`, accent: true }]} />

      <TaxTable
        rows={quotations}
        searchKeys={(row) => `${row.quoteNo} ${row.customerName} ${row.quoteDate}`}
        filter={{
          label: "Status",
          options: ["Draft", "Sent", "Accepted", "Rejected", "Expired"].map((value) => ({ value, label: value })),
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "quoteNo", label: "Quote", render: (row) => <span className="font-medium text-white">{row.quoteNo}</span> },
          { key: "customerName", label: "Customer" },
          { key: "quoteDate", label: "Date", hideOnMobile: true },
          { key: "total", label: "Total", render: (row) => formatMoney(row.total) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "View details", onSelect: () => setDetail(row) },
          { label: "Edit", onSelect: () => { setEditing(row); setFormOpen(true); } },
          { label: "Download PDF", onSelect: () => download(row) },
          { label: "Mark as sent", onSelect: () => void setQuotationStatus(row.id, "Sent").then(() => toast.success("Marked as sent")) },
          { label: "Convert to invoice", onSelect: () => void convertQuotation(row.id).then(() => toast.success("Invoice created — stock updated")) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(list) => exportCsv("quotations.csv", ["Quote", "Customer", "Date", "Total", "Status"], list.map((row) => [row.quoteNo, row.customerName, row.quoteDate, row.total, row.status]))}
        addLabel="New quotation"
        onAdd={() => { setEditing(null); setFormOpen(true); }}
        empty={{ title: "No quotations yet", description: "Create a quotation to send prices to a customer.", icon: FileText }}
      />

      <DocumentDialog
        open={formOpen}
        title={editing ? "Edit quotation" : "New quotation"}
        description="Quotations never change stock levels."
        submitLabel={editing ? "Update" : "Create"}
        dateLabel="Quote date"
        secondDateLabel="Valid until"
        statusOptions={["Draft", "Sent", "Accepted", "Rejected", "Expired"]}
        products={products}
        customers={customers}
        initial={draftFor(editing)}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.quoteNo ?? "Quotation"}
        description="Quotation details"
        rows={
          detail
            ? [
                { label: "Customer", value: detail.customerName },
                { label: "Date", value: detail.quoteDate },
                { label: "Valid until", value: detail.validUntil || "—" },
                { label: "Items", value: itemsOf(detail.id).map((item) => `${item.productName} x${item.quantity}`).join(", ") || "—" },
                { label: "Total", value: formatMoney(detail.total) },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => download(detail)}>Download PDF</Button>
              <Button className="bg-amber-400 text-black hover:bg-amber-300" onClick={() => { void convertQuotation(detail.id); setDetail(null); }}>Convert to invoice</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete quotation"
        description={`${pendingDelete?.quoteNo ?? ""} will be removed.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deleteQuotation(pendingDelete.id).then(() => toast.success("Quotation deleted")); }}
      />
    </TaxWorkspace>
  );
}
