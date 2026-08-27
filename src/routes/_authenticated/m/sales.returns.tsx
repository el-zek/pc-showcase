import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, RecordDialog, str, type FieldValue } from "@/components/tax/record-dialog";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { docNumber, formatMoney, useSales, type ReturnRecord } from "@/components/sales/sales-provider";

export const Route = createFileRoute("/_authenticated/m/sales/returns")({ component: ReturnsPage });

function ReturnsPage() {
  const { returns, returnItems, sales, saleItems, saveReturn, deleteReturn, approveReturn, metrics } = useSales();
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReturnRecord | null>(null);

  const invoices = sales.filter((row) => row.status === "Completed");

  const submit = (value: Record<string, FieldValue>) => {
    const invoiceNumber = str(value.invoiceNumber);
    const sale = invoices.find((row) => row.invoiceNumber === invoiceNumber);
    if (!sale) { toast.error("Choose an invoice to return"); return; }
    const items = saleItems
      .filter((item) => item.saleId === sale.id)
      .map((item) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal }));
    void saveReturn(
      {
        returnNo: docNumber("RET"),
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customerName,
        returnDate: str(value.returnDate),
        reason: str(value.reason),
        total: items.reduce((sum, item) => sum + item.lineTotal, 0),
        status: (str(value.status) as ReturnRecord["status"]) || "Pending",
      },
      items,
    ).then(() => {
      toast.success("Return recorded — approve it to restock");
      setFormOpen(false);
    });
  };

  return (
    <TaxWorkspace title="Returns" subtitle="Returned goods — approving a return puts stock back" icon={RotateCcw} backTo="/m/sales" backLabel="Back to Sales">
      <SummaryStrip items={[{ label: "Returned value", value: formatMoney(metrics.returnTotal), hint: `${metrics.returnCount} returns`, accent: true }]} />

      <TaxTable
        rows={returns}
        searchKeys={(row) => `${row.returnNo} ${row.invoiceNumber} ${row.customerName} ${row.returnDate}`}
        filter={{
          label: "Status",
          options: ["Pending", "Approved", "Rejected"].map((value) => ({ value, label: value })),
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "returnNo", label: "Return", render: (row) => <span className="font-medium text-white">{row.returnNo}</span> },
          { key: "invoiceNumber", label: "Invoice", hideOnMobile: true },
          { key: "customerName", label: "Customer" },
          { key: "total", label: "Value", render: (row) => formatMoney(row.total) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        rowActions={(row) => [
          { label: "Approve & restock", onSelect: () => void approveReturn(row.id).then(() => toast.success("Return approved — stock increased")) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(list) => exportCsv("returns.csv", ["Return", "Invoice", "Customer", "Date", "Value", "Status"], list.map((row) => [row.returnNo, row.invoiceNumber, row.customerName, row.returnDate, row.total, row.status]))}
        addLabel="New return"
        onAdd={() => setFormOpen(true)}
        empty={{ title: "No returns", description: "Record a return when a customer brings goods back.", icon: RotateCcw }}
      />

      <RecordDialog
        open={formOpen}
        title="New return"
        description="Select the invoice being returned. Stock increases once approved."
        submitLabel="Save"
        initialValue={{ returnDate: new Date().toISOString().slice(0, 10), status: "Pending" }}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "invoiceNumber", label: "Invoice", type: "select", options: invoices.map((row) => row.invoiceNumber), half: true },
          { name: "returnDate", label: "Date", type: "date", required: true, half: true },
          { name: "reason", label: "Reason", type: "text", half: true },
          { name: "status", label: "Status", type: "select", options: ["Pending", "Approved", "Rejected"], half: true },
        ]}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete return"
        description={`${pendingDelete?.returnNo ?? ""} will be removed.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deleteReturn(pendingDelete.id).then(() => toast.success("Return deleted")); }}
      />
    </TaxWorkspace>
  );
}
