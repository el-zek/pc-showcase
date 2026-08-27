import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HandCoins, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useTaxModule, formatCurrency, dueDateForPeriod, periodOf,
  type WithholdingRecord, type PayeRecord,
} from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/withholding")({ component: WithholdingPage });

function WithholdingPage() {
  const { withholding, saveWithholding, deleteWithholding, paye, savePaye, deletePaye } = useTaxModule();
  const [editing, setEditing] = useState<WithholdingRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<WithholdingRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WithholdingRecord | null>(null);

  const [payeEditing, setPayeEditing] = useState<PayeRecord | null>(null);
  const [payeFormOpen, setPayeFormOpen] = useState(false);
  const [payeDelete, setPayeDelete] = useState<PayeRecord | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: WithholdingRecord) => { setEditing(row); setFormOpen(true); };
  const openPayeCreate = () => { setPayeEditing(null); setPayeFormOpen(true); };
  const openPayeEdit = (row: PayeRecord) => { setPayeEditing(row); setPayeFormOpen(true); };

  const receivable = withholding.reduce((sum, row) => sum + (row.status === "Received" ? row.amount : 0), 0);
  const outstanding = withholding.filter((row) => row.paymentStatus === "Unpaid").reduce((sum, row) => sum + row.amount, 0);
  const payeDue = paye.filter((row) => row.paymentStatus === "Unpaid").reduce((sum, row) => sum + row.payeAmount, 0);

  const submit = (value: Record<string, FieldValue>) => {
    const period = periodOf(str(value.date));
    saveWithholding(
      {
        name: str(value.name),
        certificate: str(value.certificate),
        type: str(value.type),
        date: str(value.date),
        amount: num(value.amount),
        period,
        dueDate: str(value.dueDate) || dueDateForPeriod(period, 7),
        paymentStatus: str(value.paymentStatus) as WithholdingRecord["paymentStatus"],
        status: str(value.status) as WithholdingRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Record updated" : "Record created");
  };

  const submitPaye = (value: Record<string, FieldValue>) => {
    const period = str(value.period);
    savePaye(
      {
        period,
        employees: num(value.employees),
        grossPay: num(value.grossPay),
        payeAmount: num(value.payeAmount),
        dueDate: str(value.dueDate) || dueDateForPeriod(period, 7),
        paymentStatus: str(value.paymentStatus) as PayeRecord["paymentStatus"],
        status: str(value.status) as PayeRecord["status"],
      },
      payeEditing?.id,
    );
    toast.success(payeEditing ? "PAYE return updated" : "PAYE return created");
  };

  return (
    <TaxWorkspace
      title="Withholding Tax"
      subtitle="WHT certificates and PAYE returns feeding the tax calendar"
      icon={HandCoins}
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New certificate
        </Button>
      }
    >
      <SummaryStrip
        items={[
          { label: "WHT Outstanding", value: formatCurrency(outstanding), hint: "Unpaid certificates", accent: true },
          { label: "WHT Received", value: formatCurrency(receivable), hint: "Credit claimable" },
          { label: "PAYE Due", value: formatCurrency(payeDue), hint: "Unpaid payroll tax" },
          { label: "Certificates", value: String(withholding.length), hint: `${paye.length} PAYE returns` },
        ]}
      />

      <TaxTable
        rows={withholding}
        searchKeys={(row) => `${row.name} ${row.certificate} ${row.type} ${row.period} ${row.status}`}
        filter={{
          label: "Status",
          options: [
            { value: "Issued", label: "Issued" },
            { value: "Received", label: "Received" },
            { value: "Pending", label: "Pending" },
            { value: "Unpaid", label: "Unpaid" },
          ],
          match: (row, value) => (value === "Unpaid" ? row.paymentStatus === "Unpaid" : row.status === value),
        }}
        columns={[
          { key: "name", label: "Counterparty", render: (row) => <span className="font-medium text-white">{row.name}</span> },
          { key: "certificate", label: "Certificate", hideOnMobile: true },
          { key: "period", label: "Period", hideOnMobile: true },
          { key: "dueDate", label: "Due date", hideOnMobile: true },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "paymentStatus", label: "Payment", render: (row) => <StatusBadge value={row.paymentStatus} /> },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "withholding-tax.csv",
            ["Counterparty", "Certificate", "Type", "Date", "Period", "Due date", "Amount", "Payment", "Status"],
            rows.map((row) => [row.name, row.certificate, row.type, row.date, row.period, row.dueDate, row.amount, row.paymentStatus, row.status]),
          )
        }
        addLabel="New record"
        onAdd={openCreate}
        empty={{ title: "No withholding records", description: "Add certificates and payments to track WHT balances.", icon: HandCoins }}
      />

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
          <Users className="h-4 w-4 text-amber-400" /> PAYE returns
        </h2>
        <TaxTable
          rows={paye}
          searchKeys={(row) => `${row.period} ${row.status} ${row.paymentStatus}`}
          filter={{
            label: "Status",
            options: [
              { value: "Filed", label: "Filed" },
              { value: "Draft", label: "Draft" },
              { value: "Unpaid", label: "Unpaid" },
            ],
            match: (row, value) => (value === "Unpaid" ? row.paymentStatus === "Unpaid" : row.status === value),
          }}
          columns={[
            { key: "period", label: "Period", render: (row) => <span className="font-medium text-white">{row.period}</span> },
            { key: "employees", label: "Employees", hideOnMobile: true },
            { key: "grossPay", label: "Gross pay", render: (row) => formatCurrency(row.grossPay), hideOnMobile: true },
            { key: "payeAmount", label: "PAYE", render: (row) => formatCurrency(row.payeAmount) },
            { key: "dueDate", label: "Due date" },
            { key: "paymentStatus", label: "Payment", render: (row) => <StatusBadge value={row.paymentStatus} /> },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          ]}
          onEdit={openPayeEdit}
          onDelete={setPayeDelete}
          onExport={(rows) =>
            exportCsv(
              "paye-returns.csv",
              ["Period", "Employees", "Gross pay", "PAYE", "Due date", "Payment", "Status"],
              rows.map((row) => [row.period, row.employees, row.grossPay, row.payeAmount, row.dueDate, row.paymentStatus, row.status]),
            )
          }
          addLabel="New PAYE return"
          onAdd={openPayeCreate}
          empty={{ title: "No PAYE returns", description: "Record monthly payroll tax so it appears in the tax calendar.", icon: Users }}
        />
      </div>

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit withholding record" : "New withholding record"}
        description="Certificates carry a period and due date used by the tax calendar."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "name", label: "Counterparty", type: "text", required: true, half: true },
          { name: "certificate", label: "Certificate no.", type: "text", required: true, half: true },
          { name: "type", label: "Type", type: "select", options: ["Services", "Rent", "Dividends", "Interest", "Goods"], half: true },
          { name: "date", label: "Date", type: "date", required: true, half: true },
          { name: "dueDate", label: "Remittance due date", type: "date", half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "paymentStatus", label: "Payment status", type: "select", options: ["Unpaid", "Paid"], half: true },
          { name: "status", label: "Status", type: "select", options: ["Issued", "Received", "Pending"], half: true },
        ]}
      />

      <RecordDialog
        open={payeFormOpen}
        title={payeEditing ? "Edit PAYE return" : "New PAYE return"}
        description="PAYE is remitted by the 7th of the month after the payroll period."
        submitLabel={payeEditing ? "Update" : "Create"}
        initialValue={payeEditing ? { ...payeEditing } : null}
        onClose={() => setPayeFormOpen(false)}
        onSubmit={submitPaye}
        fields={[
          { name: "period", label: "Payroll period (YYYY-MM)", type: "text", required: true, half: true },
          { name: "dueDate", label: "Due date", type: "date", half: true },
          { name: "employees", label: "Employees", type: "number", required: true, half: true },
          { name: "grossPay", label: "Gross pay", type: "number", required: true, half: true },
          { name: "payeAmount", label: "PAYE amount", type: "number", required: true, half: true },
          { name: "paymentStatus", label: "Payment status", type: "select", options: ["Unpaid", "Paid"], half: true },
          { name: "status", label: "Filing status", type: "select", options: ["Draft", "Pending", "Filed"], half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description="Withholding record details"
        rows={
          detail
            ? [
                { label: "Certificate", value: detail.certificate },
                { label: "Type", value: detail.type },
                { label: "Date", value: detail.date },
                { label: "Period", value: detail.period },
                { label: "Due date", value: detail.dueDate },
                { label: "Amount", value: formatCurrency(detail.amount) },
                { label: "Payment", value: <StatusBadge value={detail.paymentStatus} /> },
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
        title="Delete withholding record"
        description={`${pendingDelete?.name ?? ""} will be removed from the register.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteWithholding(pendingDelete.id); toast.success("Record deleted"); } }}
      />

      <ConfirmDialog
        open={Boolean(payeDelete)}
        title="Delete PAYE return"
        description={`PAYE return ${payeDelete?.period ?? ""} will be removed.`}
        onClose={() => setPayeDelete(null)}
        onConfirm={() => { if (payeDelete) { deletePaye(payeDelete.id); toast.success("PAYE return deleted"); } }}
      />
    </TaxWorkspace>
  );
}
