import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { productSpec } from "@/components/sales/line-items-editor";
import { formatMoney, useSales, type SaleRecord } from "@/components/sales/sales-provider";
import { accountLabel, usePaymentAccounts } from "@/components/finance/source-payment";
import { PAYMENT_METHODS } from "@/lib/expense-catalog";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { buildSalesDocumentPdf } from "@/lib/sales-pdf";

export const Route = createFileRoute("/_authenticated/m/sales/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const business = useBusinessProfile();
  const { sales, saleItems, products, customers, deleteSale, savePayment, metrics } = useSales();
  const [detail, setDetail] = useState<SaleRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SaleRecord | null>(null);
  const [payFor, setPayFor] = useState<SaleRecord | null>(null);
  const { data: accounts = [] } = usePaymentAccounts();

  const rows = sales.filter((row) => row.status !== "Draft");
  const payState = (row: SaleRecord) => (row.amountPaid >= row.total ? "Paid" : row.amountPaid > 0 ? "Partial" : "Unpaid");
  const outstandingOf = (row: SaleRecord) => Math.max(0, row.total - row.amountPaid);

  /** Records a real customer payment; cash/bank moves once, the invoice balance follows. */
  const submitPayment = (value: Record<string, FieldValue>) => {
    if (!payFor) return;
    const amount = num(value.amount);
    const outstanding = outstandingOf(payFor);
    if (amount <= 0) { toast.error("Enter an amount greater than zero"); return; }
    if (amount > outstanding + 0.005) { toast.error("Amount is more than the outstanding balance"); return; }
    const account = (accounts as any[]).find((row) => accountLabel(row) === str(value.account));
    void savePayment({
      saleId: payFor.id,
      invoiceNumber: payFor.invoiceNumber,
      customerName: payFor.customerName,
      paymentDate: str(value.paymentDate),
      amount,
      method: account ? accountLabel(account) : str(value.paymentMethod) || "Cash",
      reference: str(value.reference),
      notes: str(value.notes),
      status: "Received",
    }).then(() => {
      toast.success("Payment recorded");
      setPayFor(null);
      setDetail(null);
    });
  };


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
          ...(outstandingOf(row) > 0 ? [{ label: "Record payment", onSelect: () => setPayFor(row) }] : []),
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
                { label: "Outstanding", value: formatMoney(outstandingOf(detail)) },
                { label: "Payment", value: <StatusBadge value={payState(detail)} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              {outstandingOf(detail) > 0 ? (
                <Button className="bg-emerald-500 text-black hover:bg-emerald-400" onClick={() => setPayFor(detail)}>
                  <CreditCard className="mr-1.5 h-4 w-4" /> Record payment
                </Button>
              ) : null}
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => download(detail)}>Download PDF</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <RecordDialog
        open={Boolean(payFor)}
        icon={CreditCard}
        title="Record payment"
        description={payFor ? `Outstanding: ${formatMoney(outstandingOf(payFor))}` : ""}
        submitLabel="Record payment"
        initialValue={{ paymentDate: new Date().toISOString().slice(0, 10), amount: payFor ? Math.round(outstandingOf(payFor)) : 0 }}
        onClose={() => setPayFor(null)}
        onSubmit={submitPayment}
        fields={[
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "paymentDate", label: "Date", type: "date", required: true, half: true },
          { name: "paymentMethod", label: "Payment method", type: "select", options: PAYMENT_METHODS, half: true },
          { name: "account", label: "Cash / bank account", type: "select", options: (accounts as any[]).map(accountLabel), half: true },
          { name: "reference", label: "Reference", type: "text", half: true },
          { name: "notes", label: "Notes", type: "text" },
        ]}
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
