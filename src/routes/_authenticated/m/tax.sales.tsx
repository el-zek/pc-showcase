import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingCart, Plus, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTaxModule, formatCurrency, periodOf, type SaleRecord } from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/sales")({ component: TaxSalesPage });

function TaxSalesPage() {
  const { sales, saveSale, saveSaleWithReceipt, deleteSale, deleteDocument, documents, documentUrl, metrics } = useTaxModule();
  const [editing, setEditing] = useState<SaleRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<SaleRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SaleRecord | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);

  const receiptFor = (saleId: string) => documents.find((row) => row.saleId === saleId);

  const openCreate = () => { setEditing(null); setReceipt(null); setFormOpen(true); };
  const openEdit = (row: SaleRecord) => { setEditing(row); setReceipt(null); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const record = {
      reference: str(value.reference),
      customer: str(value.customer),
      date: str(value.date),
      amount: num(value.amount),
      vat: num(value.vat),
      taxPeriod: periodOf(str(value.date)),
      status: str(value.status) as SaleRecord["status"],
    };
    if (receipt) {
      void saveSaleWithReceipt(record, receipt, editing?.id)
        .then(() => toast.success(editing ? "Sale updated with receipt" : "Sale saved with receipt"))
        .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save receipt"));
    } else {
      saveSale(record, editing?.id);
      toast.success("Sales record updated");
    }
    setReceipt(null);
  };

  const needsReceipt = !editing && !receipt;

  return (
    <TaxWorkspace
      title="EFD Sales"
      subtitle="Every EFD sale must carry a photo of its receipt"
      icon={ShoppingCart}
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New sale
        </Button>
      }
    >
      <SummaryStrip
        items={[{ label: "Total EFD Sales", value: formatCurrency(metrics.salesTotal), hint: `${sales.length} records`, accent: true }]}
      />

      <TaxTable
        rows={sales}
        searchKeys={(row) => `${row.customer} ${row.date} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "Recorded", label: "Recorded" },
            { value: "Reviewed", label: "Reviewed" },
            { value: "Pending", label: "Pending" },
          ],
          match: (row, value) => row.status === value,
        }}
        columns={[
          { key: "customer", label: "Customer", render: (row) => <span className="font-medium text-white">{row.customer}</span> },
          { key: "date", label: "Date", hideOnMobile: true },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "vat", label: "Tax Amount", render: (row) => formatCurrency(row.vat), hideOnMobile: true },
          {
            key: "receipt",
            label: "Receipt",
            render: (row) =>
              receiptFor(row.id) ? <span className="text-emerald-300">Attached</span> : <span className="text-rose-300">Missing</span>,
            hideOnMobile: true,
          },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onExport={(rows) =>
          exportCsv(
            "tax-sales.csv",
            ["Reference", "Customer", "Date", "Amount", "Tax Amount", "Receipt", "Status"],
            rows.map((row) => [row.reference, row.customer, row.date, row.amount, row.vat, receiptFor(row.id) ? "Attached" : "Missing", row.status]),
          )
        }
        addLabel="New sale"
        onAdd={openCreate}
        empty={{ title: "No sales recorded", description: "Add your first taxable sale to build the output VAT register.", icon: ShoppingCart }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit sales record" : "New sales record"}
        description="Capture the sale, its tax amount and a photo of the EFD receipt."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => { setFormOpen(false); setReceipt(null); }}
        onSubmit={submit}
        blockSubmit={needsReceipt ? "A photo of the EFD receipt is required." : null}
        extra={
          <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
            <Label className="text-xs uppercase tracking-[0.14em] text-white/55">EFD receipt photo</Label>
            <p className="mt-1 text-xs text-white/55">Scan or photograph the receipt — it is archived in the Document Center.</p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-sm text-amber-200">
              <Camera className="h-4 w-4" />
              {receipt ? receipt.name : "Take photo / choose image"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        }
        fields={[
          { name: "customer", label: "Customer", type: "text", required: true, half: true },
          { name: "date", label: "Date", type: "date", required: true, half: true },
          { name: "status", label: "Status", type: "select", options: ["Recorded", "Reviewed", "Pending"], half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.customer ?? "Sales record"}
        description="Sales record details"
        rows={
          detail
            ? [
                { label: "Customer", value: detail.customer },
                { label: "Date", value: detail.date },
                { label: "Amount", value: formatCurrency(detail.amount) },
                { label: "Tax amount", value: formatCurrency(detail.vat) },
                { label: "Net of tax", value: formatCurrency(detail.amount - detail.vat) },
                { label: "Receipt", value: receiptFor(detail.id) ? "Attached" : "Missing" },
                { label: "Status", value: <StatusBadge value={detail.status} /> },
              ]
            : []
        }
        footer={
          detail ? (
            <>
              {receiptFor(detail.id) ? (
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/15"
                  onClick={() => {
                    const doc = receiptFor(detail.id);
                    if (doc) void documentUrl(doc).then((url) => url && window.open(url, "_blank", "noopener"));
                  }}
                >
                  View receipt
                </Button>
              ) : null}
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => { openEdit(detail); setDetail(null); }}>Edit</Button>
              <Button className="bg-rose-500 text-white hover:bg-rose-400" onClick={() => { setPendingDelete(detail); setDetail(null); }}>Delete</Button>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete sales record"
        description={`${pendingDelete?.reference ?? ""} will be removed from your tax register.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const doc = receiptFor(pendingDelete.id);
          if (doc) deleteDocument(doc.id);
          deleteSale(pendingDelete.id);
          toast.success("Sales record deleted");
        }}
      />
    </TaxWorkspace>
  );
}
