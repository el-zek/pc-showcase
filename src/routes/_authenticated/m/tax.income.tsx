import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, Plus, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTaxModule, formatCurrency, type IncomeTaxRecord } from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/income")({ component: IncomeTaxPage });

function IncomeTaxPage() {
  const {
    metrics, incomeTax, saveIncomeTax, deleteIncomeTax,
    taxRate, setTaxRate, projectedAnnualProfit, setProjectedAnnualProfit,
  } = useTaxModule();

  const [editing, setEditing] = useState<IncomeTaxRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<IncomeTaxRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<IncomeTaxRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: IncomeTaxRecord) => { setEditing(row); setFormOpen(true); };

  const currentProfit = metrics.currentProfit;
  const estimatedTax = projectedAnnualProfit * (taxRate / 100);
  const paid = incomeTax.filter((row) => row.paymentStatus === "Paid").reduce((sum, row) => sum + row.amount, 0);
  const completion = Math.min(100, Math.round((currentProfit / Math.max(1, projectedAnnualProfit)) * 100));
  const shortfall = Math.max(0, estimatedTax - paid);
  const ratio = projectedAnnualProfit > 0 ? currentProfit / projectedAnnualProfit : 0;

  const risk = ratio >= 0.9
    ? { label: "High", tone: "from-rose-500 to-red-400", cardTone: "danger" as const, note: "Net profit is nearing, matching or exceeding the projected annual profit." }
    : ratio >= 0.6
      ? { label: "Medium", tone: "from-orange-400 to-amber-500", cardTone: "warning" as const, note: "Net profit is moving into the higher-risk range." }
      : ratio >= 0.3
        ? { label: "Moderate", tone: "from-amber-400 to-amber-300", cardTone: "warning" as const, note: "Net profit is rising but still below the higher-risk range." }
        : { label: "Low", tone: "from-emerald-400 to-emerald-300", cardTone: "success" as const, note: ratio <= 0 ? "Current position is a loss, so the risk indicator is green." : "Profit is still below the projected annual profit." };

  const submit = (value: Record<string, FieldValue>) => {
    const profitBase = num(value.profitBase);
    const rate = num(value.taxRate) || taxRate;
    saveIncomeTax(
      {
        period: str(value.period),
        installment: str(value.installment),
        profitBase,
        taxRate: rate,
        amount: Math.round((profitBase * (rate / 100)) / 4),
        dueDate: str(value.dueDate),
        paymentStatus: str(value.paymentStatus) as IncomeTaxRecord["paymentStatus"],
        status: (editing?.status ?? "Pending") as IncomeTaxRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Installment updated" : "Installment created");
  };

  const recommendations = [
    shortfall > 0
      ? `Set aside ${formatCurrency(shortfall)} before the next provisional due date.`
      : "Provisional tax is fully covered for the current estimate.",
    metrics.deductibleExpenses < metrics.expenseTotal
      ? "Attach receipts to non-deductible expenses to increase allowable deductions."
      : "All logged expenses are deductible and documented.",
    metrics.overdue > 0
      ? "Clear overdue obligations in the Tax Calendar to reduce penalty exposure."
      : "No overdue obligations — keep reminders enabled in the Tax Calendar.",
  ];

  return (
    <TaxWorkspace
      title="Income Tax"
      subtitle="Corporate income tax position and provisional installments"
      icon={Coins}
      actions={
        <>
          <Button size="sm" variant="outline" className="h-9 border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={() => setSettingsOpen(true)}>
            Assessment
          </Button>
          <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New installment
          </Button>
        </>
      }
    >
      <SummaryStrip
        items={[
          { label: "Projected Annual Profit", value: formatCurrency(projectedAnnualProfit), hint: `${completion}% realised` },
          { label: "Current Profit", value: formatCurrency(currentProfit), hint: "Sales − purchases − expenses − depreciation" },
          { label: `Estimated Tax (${taxRate}%)`, value: formatCurrency(estimatedTax), hint: `${formatCurrency(paid)} already paid` },
          { label: "Tax Risk", value: risk.label, hint: risk.note, tone: risk.cardTone },
        ]}
      />

      <section className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <TrendingUp className="h-4 w-4 text-amber-400" /> Profit trend towards projection
          </div>
          <span className="text-sm text-white/60">{completion}% of projected profit realised</span>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-white/10">
          <div className={`h-2.5 rounded-full bg-gradient-to-r ${risk.tone}`} style={{ width: `${Math.max(4, completion)}%` }} />
        </div>
        <ul className="mt-5 space-y-2">
          {recommendations.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-white/70">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <TaxTable
        rows={incomeTax}
        searchKeys={(row) => `${row.period} ${row.installment} ${row.status} ${row.paymentStatus}`}
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
          { key: "installment", label: "Installment", render: (row) => <span className="font-medium text-white">{row.installment}</span> },
          { key: "period", label: "Year", hideOnMobile: true },
          { key: "profitBase", label: "Profit base", render: (row) => formatCurrency(row.profitBase), hideOnMobile: true },
          { key: "amount", label: "Tax due", render: (row) => formatCurrency(row.amount) },
          { key: "dueDate", label: "Due date" },
          { key: "paymentStatus", label: "Payment", render: (row) => <StatusBadge value={row.paymentStatus} /> },
          { key: "status", label: "Filing", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "income-tax-installments.csv",
            ["Installment", "Year", "Profit base", "Rate", "Tax due", "Due date", "Payment", "Filing"],
            rows.map((row) => [row.installment, row.period, row.profitBase, row.taxRate, row.amount, row.dueDate, row.paymentStatus, row.status]),
          )
        }
        addLabel="New installment"
        onAdd={openCreate}
        empty={{ title: "No installments", description: "Add provisional tax installments so they appear in the tax calendar.", icon: Coins }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit installment" : "New installment"}
        description="Each installment carries a due date used by the tax calendar."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : { period: String(new Date().getFullYear()), taxRate, profitBase: projectedAnnualProfit }}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        fields={[
          { name: "period", label: "Tax year", type: "text", required: true, half: true },
          { name: "installment", label: "Installment", type: "select", options: ["Q1 provisional", "Q2 provisional", "Q3 provisional", "Q4 provisional", "Final return"], half: true },
          { name: "profitBase", label: "Profit base", type: "number", required: true, half: true },
          { name: "taxRate", label: "Tax rate (%)", type: "number", required: true, half: true },
          { name: "dueDate", label: "Due date", type: "date", required: true, half: true },
          { name: "paymentStatus", label: "Payment status", type: "select", options: ["Unpaid", "Paid"], half: true },
        ]}
      />

      <RecordDialog
        open={settingsOpen}
        title="Income tax assessment"
        description="Used for the estimated tax and risk indicator."
        submitLabel="Save"
        initialValue={{ projectedAnnualProfit, taxRate }}
        onClose={() => setSettingsOpen(false)}
        onSubmit={(value) => {
          setProjectedAnnualProfit(num(value.projectedAnnualProfit));
          setTaxRate(num(value.taxRate) || 30);
          toast.success("Assessment updated");
        }}
        fields={[
          { name: "projectedAnnualProfit", label: "Projected annual profit", type: "number", required: true, half: true },
          { name: "taxRate", label: "Tax rate (%)", type: "number", required: true, half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.installment} ${detail.period}` : ""}
        description="Provisional income tax installment"
        rows={
          detail
            ? [
                { label: "Profit base", value: formatCurrency(detail.profitBase) },
                { label: "Tax rate", value: `${detail.taxRate}%` },
                { label: "Tax due", value: formatCurrency(detail.amount) },
                { label: "Due date", value: detail.dueDate },
                { label: "Payment", value: <StatusBadge value={detail.paymentStatus} /> },
                { label: "Filing", value: <StatusBadge value={detail.status} /> },
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
        title="Delete installment"
        description={`${pendingDelete?.installment ?? ""} will be removed from the tax calendar.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteIncomeTax(pendingDelete.id); toast.success("Installment deleted"); } }}
      />
    </TaxWorkspace>
  );
}
