import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog, RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { formatMoney, useSales, type PaymentRecord } from "@/components/sales/sales-provider";

export const Route = createFileRoute("/_authenticated/m/sales/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const { payments, sales, savePayment, deletePayment, metrics } = useSales();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PaymentRecord | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => (await supabase.from("finance_accounts").select("id,name,account_number,account_type,payment_method").order("account_number")).data ?? [],
  });

  const accountOption = (account: { account_number?: string | null; name: string }) =>
    account.account_number ? `${account.account_number} · ${account.name}` : account.name;
  const accountOptions = ["cash", ...accounts.map(accountOption)];

  const invoices = sales.filter((row) => row.status === "Completed");

  const submit = (value: Record<string, FieldValue>) => {
    const invoiceNumber = str(value.invoiceNumber);
    const sale = invoices.find((row) => row.invoiceNumber === invoiceNumber);
    void savePayment(
      {
        saleId: sale?.id ?? "",
        invoiceNumber,
        customerName: sale?.customerName ?? str(value.customerName),
        paymentDate: str(value.paymentDate),
        amount: num(value.amount),
        method: str(value.method) || "cash",
        reference: str(value.reference),
        notes: "",
        status: (str(value.status) as PaymentRecord["status"]) || "Received",
      },
      editing?.id,
    ).then(() => {
      toast.success(editing ? "Payment updated" : "Payment recorded");
      setFormOpen(false);
    });
  };

  return (
    <TaxWorkspace title="Payments" subtitle="Money received against your invoices" icon={Wallet} backTo="/m/sales" backLabel="Back to Sales">
      <SummaryStrip
        items={[
          { label: "Received", value: formatMoney(metrics.paymentsTotal), hint: `${payments.length} payments`, accent: true },
          { label: "Outstanding", value: formatMoney(metrics.outstanding) },
        ]}
      />

      <TaxTable
        rows={payments}
        searchKeys={(row) => `${row.invoiceNumber} ${row.customerName} ${row.paymentDate} ${row.method}`}
        filter={{
          label: "Status",
          options: [{ value: "Received", label: "Received" }, { value: "Pending", label: "Pending" }],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "invoiceNumber", label: "Invoice", render: (row) => <span className="font-medium text-white">{row.invoiceNumber || "—"}</span> },
          { key: "customerName", label: "Customer" },
          { key: "paymentDate", label: "Date", hideOnMobile: true },
          { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        rowActions={(row) => [
          { label: "Edit", onSelect: () => { setEditing(row); setFormOpen(true); } },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(list) => exportCsv("payments.csv", ["Invoice", "Customer", "Date", "Amount", "Method"], list.map((row) => [row.invoiceNumber, row.customerName, row.paymentDate, row.amount, row.method]))}
        addLabel="Record payment"
        onAdd={() => { setEditing(null); setFormOpen(true); }}
        empty={{ title: "No payments recorded", description: "Record a payment against an invoice.", icon: Wallet }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit payment" : "Record payment"}
        description="Payments update the invoice balance."
        submitLabel={editing ? "Update" : "Save"}
        initialValue={editing ? { ...editing } : { paymentDate: new Date().toISOString().slice(0, 10), method: "cash", status: "Received" }}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "invoiceNumber", label: "Invoice", type: "select", options: invoices.map((row) => row.invoiceNumber), half: true },
          { name: "paymentDate", label: "Date", type: "date", required: true, half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "method", label: "Payment account", type: "select", options: accountOptions, half: true },
          { name: "reference", label: "Reference", type: "text", half: true },
          { name: "status", label: "Status", type: "select", options: ["Received", "Pending"], half: true },
        ]}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete payment"
        description="This payment will be removed."
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deletePayment(pendingDelete.id).then(() => toast.success("Payment deleted")); }}
      />
    </TaxWorkspace>
  );
}
