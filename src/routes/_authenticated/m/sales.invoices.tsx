import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { productSpec } from "@/components/sales/line-items-editor";
import { formatMoney, useSales, type SaleRecord } from "@/components/sales/sales-provider";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { buildSalesDocumentPdf } from "@/lib/sales-pdf";

export const Route = createFileRoute("/_authenticated/m/sales/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const business = useBusinessProfile();
  const { sales, saleItems, products, customers, deleteSale, metrics } = useSales();
  const [detail, setDetail] = useState<SaleRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SaleRecord | null>(null);

  const rows = sales.filter((row) => row.status !== "Draft");
  const payState = (row: SaleRecord) => (row.amountPaid >= row.total ? "Paid" : row.amountPaid > 0 ? "Partial" : "Unpaid");

  const download = (row: SaleRecord) => {
    const customer = customers.find((c) => c.id === row.customerId);
    buildSalesDocumentPdf(
      {
        kind: "INVOICE",
        number: row.invoiceNumber,
        date: row.saleDate,
        business,
        customer: { name: row.customerName, phone: customer?.phone, address: customer?.address },
        lines: saleItems
          .filter((item) => item.saleId === row.id)
          .map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return { name: item.productName, spec: product ? productSpec(product) : "", quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal };
          }),
        subtotal: row.subtotal,
        taxAmount: row.taxAmount,
        discountAmount: row.discountAmount,
        total: row.total,
        amountPaid: row.amountPaid,
        notes: row.notes,
      },
      `${row.invoiceNumber}.pdf`,
    );
    toast.success("Invoice PDF generated");
  };

  return (
    <TaxWorkspace title="Invoices" subtitle="Every completed sale and its payment position" icon={Receipt} backTo="/m/sales" backLabel="Back to Sales">
      <SummaryStrip
        items={[
          { label: "Invoiced", value: formatMoney(metrics.salesTotal), hint: `${metrics.salesCount} invoices`, accent: true },
          { label: "Collected", value: formatMoney(metrics.paidTotal) },
          { label: "Outstanding", value: formatMoney(metrics.outstanding) },
        ]}
      />

      <TaxTable
        rows={rows}
        searchKeys={(row) => `${row.invoiceNumber} ${row.customerName} ${row.saleDate}`}
        filter={{
          label: "Payment",
          options: [
            { value: "Paid", label: "Paid" },
            { value: "Partial", label: "Partial" },
            { value: "Unpaid", label: "Unpaid" },
          ],
          match: (row, value) => payState(row) === value,
        }}
        columns={[
          { key: "invoiceNumber", label: "Invoice", render: (row) => <span className="font-medium text-white">{row.invoiceNumber}</span> },
          { key: "customerName", label: "Customer" },
          { key: "saleDate", label: "Date", hideOnMobile: true },
          { key: "total", label: "Total", render: (row) => formatMoney(row.total) },
          { key: "pay", label: "Payment", render: (row) => <StatusBadge value={payState(row)} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "View details", onSelect: () => setDetail(row) },
          { label: "Download PDF", onSelect: () => download(row) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(list) =>
          exportCsv("invoices.csv", ["Invoice", "Customer", "Date", "Total", "Paid"], list.map((row) => [row.invoiceNumber, row.customerName, row.saleDate, row.total, row.amountPaid]))
        }
        empty={{ title: "No invoices yet", description: "Complete a sale to raise your first invoice.", icon: Receipt }}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.invoiceNumber ?? "Invoice"}
        description="Invoice details"
        rows={
          detail
            ? [
                { label: "Customer", value: detail.customerName },
                { label: "Date", value: detail.saleDate },
                { label: "Items", value: saleItems.filter((item) => item.saleId === detail.id).map((item) => `${item.productName} x${item.quantity}`).join(", ") || "—" },
                { label: "Subtotal", value: formatMoney(detail.subtotal) },
                { label: "Tax", value: formatMoney(detail.taxAmount) },
                { label: "Discount", value: formatMoney(detail.discountAmount) },
                { label: "Total", value: formatMoney(detail.total) },
                { label: "Paid", value: formatMoney(detail.amountPaid) },
                { label: "Payment", value: <StatusBadge value={payState(detail)} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => download(detail)}>Download PDF</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete invoice"
        description={`${pendingDelete?.invoiceNumber ?? ""} will be removed.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void deleteSale(pendingDelete.id).then(() => toast.success("Invoice deleted"));
        }}
      />
    </TaxWorkspace>
  );
}
