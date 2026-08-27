import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Landmark, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import {
  ACCOUNT_TYPES, formatMoney, useFinance, type AccountRecord, type AccountWithBalance,
} from "@/components/finance/finance-provider";

export const Route = createFileRoute("/_authenticated/m/finance/accounts")({ component: AccountsPage });

function AccountsPage() {
  const { accounts, saveAccount, deleteAccount, metrics } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [detail, setDetail] = useState<AccountWithBalance | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountWithBalance | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: AccountWithBalance) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    void saveAccount(
      {
        name: str(value.name),
        accountType: str(value.accountType) || "Bank",
        paymentMethod: str(value.name),
        accountNumber: str(value.accountNumber),
        currency: str(value.currency) || "TZS",
        openingBalance: num(value.openingBalance),
        status: (str(value.status) as AccountRecord["status"]) || "Active",
        notes: str(value.notes),
      },
      editing?.id,
    ).then(() => toast.success(editing ? "Account updated" : "Account created"));
  };

  return (
    <TaxWorkspace
      title="Accounts"
      subtitle="Bank, cash and mobile money accounts"
      icon={Landmark}
      backTo="/m/finance"
      backLabel="Back to Finance"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New account
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Total Balance", value: formatMoney(metrics.totalBalance), hint: `${accounts.length} accounts`, accent: true },
          { label: "Active Accounts", value: String(metrics.activeAccounts) },
        ]}
      />

      <TaxTable
        rows={accounts}
        searchKeys={(row) => `${row.name} ${row.accountType} ${row.paymentMethod} ${row.accountNumber}`}
        filter={{
          label: "Type",
          options: ACCOUNT_TYPES.map((value) => ({ value, label: value })),
          match: (row, value) => row.accountType === value,
        }}
        columns={[
          { key: "name", label: "Account", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "accountType", label: "Type" },
          { key: "accountNumber", label: "Number", hideOnMobile: true, render: (row) => row.accountNumber || "—" },
          { key: "currentBalance", label: "Balance", render: (row) => formatMoney(row.currentBalance) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "Edit", onSelect: () => openEdit(row) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(rows) =>
          exportCsv(
            "finance-accounts.csv",
            ["Account", "Type", "Number", "Currency", "Opening", "Balance", "Status"],
            rows.map((row) => [row.name, row.accountType, row.accountNumber, row.currency, row.openingBalance, row.currentBalance, row.status]),
          )
        }
        addLabel="New account"
        onAdd={openCreate}
        empty={{ title: "No accounts yet", description: "Add bank, cash or mobile money accounts to track balances.", icon: Landmark }}
      />

      <RecordDialog
        open={formOpen}
        icon={Landmark}
        title={editing ? "Edit account" : "New account"}
        description="Accounts supply the payment methods used across Finance."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : { currency: "TZS", status: "Active" }}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "name", label: "Account name", type: "text", required: true, half: true },
          { name: "accountType", label: "Account type", type: "select", options: [...ACCOUNT_TYPES], half: true },
          { name: "accountNumber", label: "Account number", type: "text", half: true },
          { name: "currency", label: "Currency", type: "text", half: true },
          { name: "openingBalance", label: "Opening balance", type: "number", half: true },
          { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], half: true },
          { name: "notes", label: "Notes", type: "text" },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Account details"
        icon={Landmark}
        rows={
          detail
            ? [
                { label: "Type", value: detail.accountType },
                { label: "Number", value: detail.accountNumber || "—" },
                { label: "Currency", value: detail.currency },
                { label: "Opening balance", value: formatMoney(detail.openingBalance) },
                { label: "Movement", value: formatMoney(detail.movement) },
                { label: "Current balance", value: formatMoney(detail.currentBalance) },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
                { label: "Notes", value: detail.notes || "—" },
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
        title="Delete account"
        description={`${pendingDelete?.name ?? ""} will be removed from your accounts.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void deleteAccount(pendingDelete.id).then(() => toast.success("Account deleted")); }}
      />
    </TaxWorkspace>
  );
}
