import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import {
  PAYMENT_TYPES, directionForType, formatMoney, useFinance, type FinancePaymentRecord,
} from "@/components/finance/finance-provider";

export const Route = createFileRoute("/_authenticated/m/finance/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const { payments, accounts, savePayment, deletePayment, metrics, accountName } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancePaymentRecord | null>(null);
  const [detail, setDetail] = useState<FinancePaymentRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FinancePaymentRecord | null>(null);
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});
  const [attachment, setAttachment] = useState<File | null>(null);

  const accountOption = (account: { accountNumber: string; name: string }) =>
    account.accountNumber ? `${account.accountNumber} · ${account.name}` : account.name;
  const defaultAccountOption = accounts.find((row) => row.accountType === "Cash" || row.paymentMethod?.toLowerCase() === "cash" || row.name.toLowerCase() === "cash")
    ? accountOption(accounts.find((row) => row.accountType === "Cash" || row.paymentMethod?.toLowerCase() === "cash" || row.name.toLowerCase() === "cash")!)
    : accounts[0]
      ? accountOption(accounts[0])
      : "";

  const paymentType = str(draft.paymentType);
  const direction = paymentType ? directionForType(paymentType) : "out";

  const openCreate = () => {
    setEditing(null);
    setAttachment(null);
    setDraft({ paymentDate: new Date().toISOString().slice(0, 10), status: "Completed", paymentType: "Customer Payment", paymentMethod: defaultAccountOption });
    setFormOpen(true);
  };
  const openEdit = (row: FinancePaymentRecord) => {
    setEditing(row);
    setAttachment(null);
    const account = accounts.find((item) => item.id === row.accountId);
    setDraft({
      paymentType: row.paymentType,
      paymentMethod: account ? accountOption(account) : accountName(row.accountId),
      amount: row.amount,
      paymentDate: row.paymentDate,
      notes: row.notes,
      status: row.status,
    });
    setFormOpen(true);
  };

  const submit = (value: Record<string, FieldValue>) => {
    const type = str(value.paymentType) || "Manual Payment";
    const account = accounts.find((row) => accountOption(row) === str(value.paymentMethod));
    void savePayment(
      {
        paymentType: type,
        paymentMethod: account?.paymentMethod || account?.name || "cash",
        accountId: account?.id ?? "",
        direction: directionForType(type),
        amount: num(value.amount),
        paymentDate: str(value.paymentDate),
        reference: editing?.reference ?? "",
        customerId: editing?.customerId ?? "",
        customerName: editing?.customerName ?? "",
        supplierId: editing?.supplierId ?? "",
        supplierName: editing?.supplierName ?? "",
        invoiceNumber: editing?.invoiceNumber ?? "",
        description: editing?.description ?? "",
        attachmentPath: editing?.attachmentPath ?? "",
        notes: str(value.notes),
        status: (str(value.status) as FinancePaymentRecord["status"]) || "Completed",
      },
      editing?.id,
      attachment,
    ).then(() => toast.success(editing ? "Payment updated" : "Payment recorded"));
  };

  return (
    <TaxWorkspace
      title="Payments"
      subtitle="Master register for every money in and money out"
      icon={CreditCard}
      backTo="/m/finance"
      backLabel="Back to Finance"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New payment
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Money In", value: formatMoney(metrics.moneyIn), hint: `${payments.length} payments`, accent: true },
          { label: "Money Out", value: formatMoney(metrics.moneyOut) },
          { label: "Net Cash", value: formatMoney(metrics.netCash) },
        ]}
      />

      <TaxTable
        rows={payments}
        searchKeys={(row) => `${row.paymentType} ${accountName(row.accountId)} ${row.paymentMethod} ${row.paymentDate}`}
        filter={{
          label: "Direction",
          options: [
            { value: "in", label: "Money In" },
            { value: "out", label: "Money Out" },
            { value: "Completed", label: "Completed" },
            { value: "Pending", label: "Pending" },
          ],
          match: (row, value) => (value === "in" || value === "out" ? row.direction === value : row.status === value),
        }}
        columns={[
          { key: "paymentType", label: "Type", render: (row) => <span className="font-medium text-white">{row.paymentType}</span> },
          { key: "account", label: "Account", render: (row) => accountName(row.accountId) || "—" },
          { key: "paymentDate", label: "Date", hideOnMobile: true },
          {
            key: "amount",
            label: "Amount",
            render: (row) => (
              <span className={row.direction === "in" ? "text-emerald-300" : "text-rose-300"}>
                {row.direction === "in" ? "+" : "−"}{formatMoney(row.amount)}
              </span>
            ),
          },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "Edit", onSelect: () => openEdit(row) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(rows) =>
          exportCsv(
            "finance-payments.csv",
            ["Type", "Account", "Date", "Direction", "Amount", "Status"],
            rows.map((row) => [row.paymentType, accountName(row.accountId), row.paymentDate, row.direction === "in" ? "Money In" : "Money Out", row.amount, row.status]),
          )
        }
        addLabel="New payment"
        onAdd={openCreate}
        empty={{ title: "No payments recorded", description: "Record customer, supplier, salary or tax payments here.", icon: CreditCard }}
      />

      <RecordDialog
        open={formOpen}
        icon={CreditCard}
        title={editing ? "Edit payment" : "New payment"}
        description="Every payment updates the selected account balance."
        submitLabel={editing ? "Update" : "Save payment"}
        initialValue={draft}
        onChange={setDraft}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        extra={
          <div className="space-y-3">
            <p className="text-xs text-white/50">
              Direction: <span className={direction === "in" ? "text-emerald-300" : "text-rose-300"}>{direction === "in" ? "Money In" : "Money Out"}</span>
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">Attachment (optional)</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-black"
              />
            </label>
          </div>
        }
        fields={[
          { name: "paymentType", label: "Payment type", type: "select", options: [...PAYMENT_TYPES], required: true, half: true },
          { name: "paymentMethod", label: "Payment account", type: "select", options: accounts.map(accountOption), required: true, half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "paymentDate", label: "Date", type: "date", required: true, half: true },
          { name: "status", label: "Status", type: "select", options: ["Completed", "Pending", "Cancelled"], half: true },
          { name: "notes", label: "Notes", type: "text" },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.paymentType ?? ""}
        description="Payment details"
        icon={CreditCard}
        rows={
          detail
            ? [
                { label: "Direction", value: detail.direction === "in" ? "Money In" : "Money Out" },
                { label: "Amount", value: formatMoney(detail.amount) },
                { label: "Account", value: accountName(detail.accountId) || "—" },
                { label: "Date", value: detail.paymentDate },
                { label: "Attachment", value: detail.attachmentPath ? "Attached" : "—" },
                { label: "Notes", value: detail.notes || "—" },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => { openEdit(detail); setDetail(null); }}>Edit</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete payment"
        description="This payment will be removed and balances recalculated."
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deletePayment(pendingDelete.id).then(() => toast.success("Payment deleted")); }}
      />
    </TaxWorkspace>
  );
}
