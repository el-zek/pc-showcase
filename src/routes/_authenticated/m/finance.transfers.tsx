import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { formatMoney, useFinance, type TransferRecord } from "@/components/finance/finance-provider";

export const Route = createFileRoute("/_authenticated/m/finance/transfers")({ component: TransfersPage });

function TransfersPage() {
  const { transfers, accounts, saveTransfer, deleteTransfer, metrics } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransferRecord | null>(null);
  const [detail, setDetail] = useState<TransferRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransferRecord | null>(null);
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});

  const names = accounts.map((row) => row.name);
  const byName = (name: string) => accounts.find((row) => row.name === name);

  const from = byName(str(draft.fromAccount));
  const to = byName(str(draft.toAccount));
  const amount = num(draft.amount);
  const blockSubmit =
    draft.fromAccount && draft.toAccount && str(draft.fromAccount) === str(draft.toAccount)
      ? "Source and destination account cannot be the same."
      : amount <= 0 && draft.amount !== undefined && draft.amount !== ""
        ? "Amount must be greater than zero."
        : from && amount > from.currentBalance && !editing
          ? `${from.name} has only ${formatMoney(from.currentBalance)} available.`
          : null;

  const openCreate = () => { setEditing(null); setDraft({ transferDate: new Date().toISOString().slice(0, 10), status: "Completed" }); setFormOpen(true); };
  const openEdit = (row: TransferRecord) => {
    setEditing(row);
    setDraft({ fromAccount: row.fromAccountName, toAccount: row.toAccountName, amount: row.amount, transferDate: row.transferDate, reference: row.reference, description: row.description, notes: row.notes, status: row.status });
    setFormOpen(true);
  };

  const submit = (value: Record<string, FieldValue>) => {
    const source = byName(str(value.fromAccount));
    const target = byName(str(value.toAccount));
    void saveTransfer(
      {
        fromAccountId: source?.id ?? "",
        fromAccountName: source?.name ?? str(value.fromAccount),
        toAccountId: target?.id ?? "",
        toAccountName: target?.name ?? str(value.toAccount),
        amount: num(value.amount),
        transferDate: str(value.transferDate),
        reference: str(value.reference),
        description: str(value.description),
        notes: str(value.notes),
        status: (str(value.status) as TransferRecord["status"]) || "Completed",
      },
      editing?.id,
    ).then(() => toast.success(editing ? "Transfer updated" : "Transfer recorded"));
  };

  return (
    <TaxWorkspace
      title="Transfers"
      subtitle="Move money between your internal accounts"
      icon={ArrowLeftRight}
      backTo="/m/finance"
      backLabel="Back to Finance"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New transfer
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Transferred", value: formatMoney(metrics.transferTotal), hint: `${transfers.length} transfers`, accent: true },
          { label: "Total Balance", value: formatMoney(metrics.totalBalance) },
        ]}
      />

      <TaxTable
        rows={transfers}
        searchKeys={(row) => `${row.fromAccountName} ${row.toAccountName} ${row.reference} ${row.transferDate}`}
        filter={{
          label: "Status",
          options: [
            { value: "Completed", label: "Completed" },
            { value: "Pending", label: "Pending" },
            { value: "Cancelled", label: "Cancelled" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "fromAccountName", label: "From", render: (row) => <span className="font-medium text-white">{row.fromAccountName || "—"}</span> },
          { key: "toAccountName", label: "To" },
          { key: "transferDate", label: "Date", hideOnMobile: true },
          { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "Edit", onSelect: () => openEdit(row) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(rows) =>
          exportCsv(
            "finance-transfers.csv",
            ["From", "To", "Date", "Amount", "Reference", "Status"],
            rows.map((row) => [row.fromAccountName, row.toAccountName, row.transferDate, row.amount, row.reference, row.status]),
          )
        }
        addLabel="New transfer"
        onAdd={openCreate}
        empty={{ title: "No transfers recorded", description: "Move money between accounts, for example CRDB to Cash.", icon: ArrowLeftRight }}
      />

      <RecordDialog
        open={formOpen}
        icon={ArrowLeftRight}
        title={editing ? "Edit transfer" : "New transfer"}
        description="Transfers only move money between your own accounts."
        submitLabel={editing ? "Update" : "Transfer"}
        initialValue={draft}
        onChange={setDraft}
        blockSubmit={blockSubmit}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        extra={
          from ? (
            <p className="text-xs text-white/50">
              Available in {from.name}: <span className="text-white/80">{formatMoney(from.currentBalance)}</span>
              {to ? ` · ${to.name}: ${formatMoney(to.currentBalance)}` : ""}
            </p>
          ) : null
        }
        fields={[
          { name: "fromAccount", label: "From account", type: "select", options: names, required: true, half: true },
          { name: "toAccount", label: "To account", type: "select", options: names, required: true, half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "transferDate", label: "Date", type: "date", required: true, half: true },
          { name: "reference", label: "Reference number", type: "text", half: true },
          { name: "status", label: "Status", type: "select", options: ["Completed", "Pending", "Cancelled"], half: true },
          { name: "description", label: "Description", type: "text" },
          { name: "notes", label: "Notes", type: "text" },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.fromAccountName} → ${detail.toAccountName}` : ""}
        description="Transfer details"
        icon={ArrowLeftRight}
        rows={
          detail
            ? [
                { label: "From", value: detail.fromAccountName },
                { label: "To", value: detail.toAccountName },
                { label: "Amount", value: formatMoney(detail.amount) },
                { label: "Date", value: detail.transferDate },
                { label: "Reference", value: detail.reference || "—" },
                { label: "Description", value: detail.description || "—" },
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
        title="Delete transfer"
        description="This transfer will be removed and balances recalculated."
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deleteTransfer(pendingDelete.id).then(() => toast.success("Transfer deleted")); }}
      />
    </TaxWorkspace>
  );
}
