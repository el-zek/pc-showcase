import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Percent, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTaxModule, formatCurrency, dueDateForPeriod, type VatReturnRecord } from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/vat")({ component: VatPage });

function VatPage() {
  const { vatReturns, saveVatReturn, deleteVatReturn, metrics } = useTaxModule();
  const [editing, setEditing] = useState<VatReturnRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<VatReturnRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VatReturnRecord | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: VatReturnRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    const outputVat = num(value.outputVat);
    const inputVat = num(value.inputVat);
    saveVatReturn(
      {
        period: str(value.period),
        outputVat,
        inputVat,
        payable: Math.max(0, outputVat - inputVat),
        dueDate: str(value.dueDate) || dueDateForPeriod(str(value.period)),
        paymentStatus: str(value.paymentStatus) as VatReturnRecord["paymentStatus"],
        status: str(value.status) as VatReturnRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "VAT return updated" : "VAT return created");
  };

  return (
    <TaxWorkspace
      title="VAT"
      subtitle="Output VAT, input VAT and return filing"
      icon={Percent}
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New return
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Output VAT", value: formatCurrency(metrics.outputVat), hint: "Collected on sales", accent: true },
          { label: "Input VAT", value: formatCurrency(metrics.inputVat), hint: "Claimable on purchases" },
          { label: "VAT Balance", value: formatCurrency(metrics.vatPayable), hint: "Payable to authority" },
          { label: "Unfiled Returns", value: String(vatReturns.filter((row) => row.status !== "Filed").length), hint: "Action required" },
        ]}
      />

      <TaxTable
        rows={vatReturns}
        searchKeys={(row) => `${row.period} ${row.status} ${row.paymentStatus}`}
        filter={{
          label: "Status",
          options: [
            { value: "Filed", label: "Filed" },
            { value: "Draft", label: "Draft" },
            { value: "Pending", label: "Pending" },
            { value: "Unpaid", label: "Unpaid" },
          ],
          match: (row, value) => (value === "Unpaid" ? row.paymentStatus === "Unpaid" : row.status === value),
        }}
        columns={[
          { key: "period", label: "Period", render: (row) => <span className="font-medium text-white">{row.period}</span> },
          { key: "outputVat", label: "Output VAT", render: (row) => formatCurrency(row.outputVat), hideOnMobile: true },
          { key: "inputVat", label: "Input VAT", render: (row) => formatCurrency(row.inputVat), hideOnMobile: true },
          { key: "payable", label: "Balance", render: (row) => formatCurrency(row.payable) },
          { key: "paymentStatus", label: "Payment", render: (row) => <StatusBadge value={row.paymentStatus} /> },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "vat-returns.csv",
            ["Period", "Output VAT", "Input VAT", "Balance", "Payment", "Status"],
            rows.map((row) => [row.period, row.outputVat, row.inputVat, row.payable, row.paymentStatus, row.status]),
          )
        }
        addLabel="New return"
        onAdd={openCreate}
        empty={{ title: "No VAT returns", description: "Create a VAT return to track your filing position.", icon: Percent }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit VAT return" : "New VAT return"}
        description="Balance is calculated as output VAT minus input VAT."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "period", label: "Period (YYYY-MM)", type: "text", required: true, half: true },
          { name: "dueDate", label: "Filing due date", type: "date", half: true },
          { name: "status", label: "Filing status", type: "select", options: ["Draft", "Pending", "Filed"], half: true },
          { name: "outputVat", label: "Output VAT", type: "number", required: true, half: true },
          { name: "inputVat", label: "Input VAT", type: "number", required: true, half: true },
          { name: "paymentStatus", label: "Payment status", type: "select", options: ["Unpaid", "Partial", "Paid"], half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.period ?? ""}
        description="VAT return details"
        rows={
          detail
            ? [
                { label: "Output VAT", value: formatCurrency(detail.outputVat) },
                { label: "Input VAT", value: formatCurrency(detail.inputVat) },
                { label: "Balance", value: formatCurrency(detail.payable) },
                { label: "Payment status", value: <StatusBadge value={detail.paymentStatus} /> },
                { label: "Filing status", value: <StatusBadge value={detail.status} /> },
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
        title="Delete VAT return"
        description={`${pendingDelete?.period ?? ""} will be removed from your VAT history.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteVatReturn(pendingDelete.id); toast.success("VAT return deleted"); } }}
      />
    </TaxWorkspace>
  );
}
