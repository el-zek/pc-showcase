import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag, Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTaxModule, formatCurrency, periodOf, type PurchaseRecord } from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/purchases")({ component: PurchasesPage });

function PurchasesPage() {
  const { purchases, savePurchase, deletePurchase, metrics } = useTaxModule();
  const [editing, setEditing] = useState<PurchaseRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PurchaseRecord | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: PurchaseRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    savePurchase(
      {
        supplier: str(value.supplier),
        date: str(value.date),
        amount: num(value.amount),
        category: str(value.category),
        deductible: editing?.deductible ?? true,
        attachment: editing?.attachment ?? false,
        taxPeriod: periodOf(str(value.date)),
        status: str(value.status) as PurchaseRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Purchase updated" : "Purchase created");
  };

  return (
    <TaxWorkspace
      title="Purchases"
      subtitle="Supplier purchases and tax deductions"
      icon={ShoppingBag}
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New purchase
        </Button>
      }
    >
      <SummaryStrip
        items={[{ label: "Total Purchases", value: formatCurrency(metrics.purchaseTotal), hint: `${purchases.length} records`, accent: true }]}
      />

      <TaxTable
        rows={purchases}
        searchKeys={(row) => `${row.supplier} ${row.category} ${row.date} ${row.status}`}
        filter={{
          label: "Type",
          options: [
            { value: "deductible", label: "Deductible" },
            { value: "non-deductible", label: "Non-deductible" },
            { value: "Verified", label: "Verified" },
            { value: "Pending", label: "Pending" },
          ],
          match: (row, value) =>
            value === "deductible" ? row.deductible : value === "non-deductible" ? !row.deductible : row.status === value,
        }}
        columns={[
          { key: "supplier", label: "Supplier", render: (row) => <span className="font-medium text-white">{row.supplier}</span> },
          { key: "category", label: "Category", hideOnMobile: true },
          { key: "date", label: "Date", hideOnMobile: true },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "deductible", label: "Deduction", render: (row) => (row.deductible ? formatCurrency(row.amount * 0.18) : "—") },
          {
            key: "attachment",
            label: "Attachment",
            hideOnMobile: true,
            render: (row) => (row.attachment ? <span className="inline-flex items-center gap-1 text-emerald-200"><Paperclip className="h-3.5 w-3.5" /> Attached</span> : <span className="text-white/40">None</span>),
          },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "tax-purchases.csv",
            ["Supplier", "Category", "Date", "Amount", "Deductible", "Attachment", "Status"],
            rows.map((row) => [row.supplier, row.category, row.date, row.amount, row.deductible ? "Yes" : "No", row.attachment ? "Yes" : "No", row.status]),
          )
        }
        addLabel="New purchase"
        onAdd={openCreate}
        empty={{ title: "No purchases recorded", description: "Add supplier purchases to claim tax deductions.", icon: ShoppingBag }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit purchase" : "New purchase"}
        description="Record supplier spend and deduction eligibility."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "supplier", label: "Supplier", type: "text", required: true, half: true },
          { name: "category", label: "Category", type: "select", options: ["Inventory", "Services", "Utilities", "Transport", "Entertainment", "Other"], half: true },
          { name: "date", label: "Date", type: "date", required: true, half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "status", label: "Status", type: "select", options: ["Verified", "Pending"], half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.supplier ?? ""}
        description="Purchase details"
        rows={
          detail
            ? [
                { label: "Category", value: detail.category },
                { label: "Date", value: detail.date },
                { label: "Amount", value: formatCurrency(detail.amount) },
                { label: "Deductible", value: detail.deductible ? "Yes" : "No" },
                { label: "Input VAT", value: detail.deductible ? formatCurrency(detail.amount * 0.18) : "—" },
                { label: "Attachment", value: detail.attachment ? "On file" : "Missing" },
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
        title="Delete purchase"
        description={`${pendingDelete?.supplier ?? ""} will be removed from your purchase register.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deletePurchase(pendingDelete.id); toast.success("Purchase deleted"); } }}
      />
    </TaxWorkspace>
  );
}
