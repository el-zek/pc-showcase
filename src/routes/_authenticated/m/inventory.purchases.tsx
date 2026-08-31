import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Plus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TaxModuleProvider,
  useTaxModule,
  formatCurrency,
  periodOf,
  type PurchaseRecord,
} from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { SourcePaymentDialog, payStateOf } from "@/components/finance/source-payment";
import { deleteLinkedPayments, fetchLinkedPaymentMap, sumCompleted } from "@/lib/finance-link";

export const Route = createFileRoute("/_authenticated/m/inventory/purchases")({
  component: () => (
    <TaxModuleProvider>
      <PurchasesPage />
    </TaxModuleProvider>
  ),
});

function PurchasesPage() {
  const { purchases, savePurchase, deletePurchase, metrics } = useTaxModule();
  const [editing, setEditing] = useState<PurchaseRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PurchaseRecord | null>(null);
  const [payFor, setPayFor] = useState<PurchaseRecord | null>(null);

  // Money actually paid to suppliers — purchases themselves never move cash.
  const { data: paymentMap = {}, refetch: refetchPayments } = useQuery({
    queryKey: ["linked-payments", "purchase"],
    queryFn: () => fetchLinkedPaymentMap("purchase"),
  });
  const paidOf = (row: PurchaseRecord) => sumCompleted(paymentMap[row.id] ?? []);
  const outstandingOf = (row: PurchaseRecord) => Math.max(0, row.amount - paidOf(row));
  const payStateFor = (row: PurchaseRecord) => payStateOf(row.amount, paidOf(row));
  const totalPaid = purchases.reduce((sum, row) => sum + paidOf(row), 0);

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
      subtitle="Supplier purchases"
      icon={ShoppingBag}
      backTo="/m/inventory"
      backLabel="Back to Inventory"
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New purchase
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Total Purchases", value: formatCurrency(metrics.purchaseTotal), hint: `${purchases.length} records`, accent: true },
          { label: "Paid", value: formatCurrency(totalPaid), tone: "success" },
          { label: "Outstanding", value: formatCurrency(purchases.reduce((sum, row) => sum + outstandingOf(row), 0)), tone: "warning" },
        ]}
      />

      <TaxTable
        rows={purchases}
        searchKeys={(row) => `${row.supplier} ${row.date} ${row.status}`}
        filter={{
          label: "Payment",
          options: [
            { value: "Paid", label: "Paid" },
            { value: "Partially Paid", label: "Partially Paid" },
            { value: "Unpaid", label: "Unpaid" },
          ],
          match: (row, value) => payStateFor(row) === value,
        }}
        columns={[
          { key: "supplier", label: "Supplier", render: (row) => <span className="font-medium text-white">{row.supplier}</span> },
          { key: "date", label: "Date", hideOnMobile: true },
          { key: "amount", label: "Total", render: (row) => formatCurrency(row.amount) },
          { key: "paid", label: "Paid", hideOnMobile: true, render: (row) => formatCurrency(paidOf(row)) },
          { key: "pay", label: "Payment", render: (row) => <StatusBadge value={payStateFor(row)} /> },
        ]}
        onRowClick={setDetail}
        rowActions={(row) => [
          { label: "View details", onSelect: () => setDetail(row) },
          ...(outstandingOf(row) > 0 ? [{ label: "Pay supplier", onSelect: () => setPayFor(row) }] : []),
          { label: "Edit", onSelect: () => openEdit(row) },
          { label: "Delete", onSelect: () => setPendingDelete(row), danger: true },
        ]}
        onExport={(rows) =>
          exportCsv(
            "purchases.csv",
            ["Supplier", "Date", "Total", "Paid", "Outstanding", "Status"],
            rows.map((row) => [row.supplier, row.date, row.amount, paidOf(row), outstandingOf(row), payStateFor(row)]),
          )
        }
        addLabel="New purchase"
        onAdd={openCreate}
        empty={{ title: "No purchases recorded", description: "Add supplier purchases to track your spending.", icon: ShoppingBag }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit purchase" : "New purchase"}
        description="Record supplier spend."
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
                { label: "Date", value: detail.date },
                { label: "Total", value: formatCurrency(detail.amount) },
                { label: "Paid", value: formatCurrency(paidOf(detail)) },
                { label: "Outstanding", value: formatCurrency(outstandingOf(detail)) },
                { label: "Payment", value: <StatusBadge value={payStateFor(detail)} /> },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              {outstandingOf(detail) > 0 ? (
                <Button className="bg-emerald-500 text-black hover:bg-emerald-400" onClick={() => setPayFor(detail)}>
                  <CreditCard className="mr-1.5 h-4 w-4" /> Pay supplier
                </Button>
              ) : null}
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => { openEdit(detail); setDetail(null); }}>Edit</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      {payFor ? (
        <SourcePaymentDialog
          open
          onClose={() => setPayFor(null)}
          sourceType="purchase"
          sourceId={payFor.id}
          outstanding={outstandingOf(payFor)}
          direction="out"
          paymentType="Supplier Payment"
          description={`Payment to ${payFor.supplier}`}
          counterparty={{ supplierName: payFor.supplier }}
          onSaved={async () => { await refetchPayments(); setDetail(null); }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete purchase"
        description={`${pendingDelete?.supplier ?? ""} will be removed from your purchase register.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const id = pendingDelete.id;
          deletePurchase(id);
          void deleteLinkedPayments("purchase", id).then(() => refetchPayments());
          toast.success("Purchase deleted");
        }}
      />

    </TaxWorkspace>
  );
}
