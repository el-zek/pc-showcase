import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTaxModule, formatCurrency, periodOf, type ExpenseRecord } from "@/components/tax-module-provider";
import { RecordDialog, ConfirmDialog, bool, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { DetailsDrawer, StatusBadge, SummaryStrip, TaxTable, TaxWorkspace, exportCsv } from "@/components/tax/tax-workspace";
import { EXPENSE_CATALOG, EXPENSE_FREQUENCIES, PAYMENT_METHODS, itemsForCategory, daysUntil, advanceDate } from "@/lib/expense-catalog";

/**
 * Single Expenses module, shared by Tax Management and Finance.
 * Same table, same logic, same UI — only the back link differs.
 */
export function ExpensesPage({ backTo, backLabel }: { backTo?: string; backLabel?: string } = {}) {
  const { expenses, saveExpense, deleteExpense, metrics, refresh } = useTaxModule();
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<ExpenseRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExpenseRecord | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: customCategories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => (await supabase.from("expense_categories").select("name,parent_name").eq("active", true)).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["expense-suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id,name").order("name")).data ?? [],
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["expense-campaigns"],
    queryFn: async () => (await supabase.from("marketing_campaigns").select("id,name").order("name")).data ?? [],
  });

  const categories = useMemo(() => Array.from(new Set([
    ...EXPENSE_CATALOG.map((group) => group.category),
    ...customCategories.filter((row: any) => !row.parent_name).map((row: any) => row.name),
  ])), [customCategories]);
  const itemOptions = itemsForCategory(selectedCategory, customCategories as { name: string; parent_name: string | null }[]);
  const upcoming = expenses.filter((row) => row.isRecurring && row.nextDueDate && daysUntil(row.nextDueDate) <= 30).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const createOccurrence = async (template: ExpenseRecord) => {
    if (!template.nextDueDate) return;
    // Duplicate prevention: never create a second occurrence for the same template + due date.
    const already = expenses.some((row) => row.recurringParentId === template.id && row.date === template.nextDueDate);
    if (already) {
      toast.info("An occurrence for this due date already exists");
      return;
    }
    saveExpense({
      description: template.description, category: template.category, item: template.item, date: template.nextDueDate,
      amount: template.amount, vatAmount: template.vatAmount, payee: template.payee, supplierId: template.supplierId,
      paymentMethod: template.paymentMethod, reference: template.reference, notes: template.notes, attachmentPath: template.attachmentPath,
      branch: template.branch, campaignId: template.campaignId, isRecurring: false, frequency: "one_time", nextDueDate: "",
      recurringParentId: template.id, deductible: template.deductible, receipt: template.receipt, taxPeriod: periodOf(template.nextDueDate), status: "Pending",
    });
    await supabase.from("tax_expenses").update({ next_due_date: advanceDate(template.nextDueDate, template.frequency) }).eq("id", template.id);
    await refresh();
    toast.success("Pending expense created — confirm it to approve the payment");
  };


  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: ExpenseRecord) => { setEditing(row); setFormOpen(true); };

  const submit = (value: Record<string, FieldValue>) => {
    saveExpense(
      {
        description: str(value.description),
        category: str(value.category),
        date: str(value.date),
        amount: num(value.amount),
        deductible: editing ? editing.deductible : bool(value.deductible) || true,
        receipt: editing ? editing.receipt : Boolean(value.attachmentPath),
        item: str(value.item),
        vatAmount: num(value.vatAmount),
        payee: str(value.payee),
        supplierId: str(value.supplierId).split(" — ")[0],
        paymentMethod: str(value.paymentMethod),
        reference: str(value.reference),
        notes: str(value.notes),
        attachmentPath: str(value.attachmentPath),
        branch: str(value.branch),
        campaignId: str(value.campaignId).split(" — ")[0],
        isRecurring: bool(value.isRecurring),
        frequency: str(value.frequency),
        nextDueDate: str(value.nextDueDate),
        recurringParentId: str(value.recurringParentId).split(" — ")[0],
        taxPeriod: periodOf(str(value.date)),
        status: str(value.status) as ExpenseRecord["status"],
      },
      editing?.id,
    );
    toast.success(editing ? "Expense updated" : "Expense created");
  };

  return (
    <TaxWorkspace
      title="Expenses"
      subtitle="Deductible business expenses and receipts"
      icon={Receipt}
      {...(backTo ? { backTo } : {})}
      {...(backLabel ? { backLabel } : {})}
      actions={
        <Button size="sm" className="h-9 bg-amber-400 text-black hover:bg-amber-300" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> New expense
        </Button>
      }
    >
      <SummaryStrip
        items={[{ label: "Total Expenses", value: formatCurrency(metrics.expenseTotal), hint: `${expenses.length} records`, accent: true }]}
      />

      {upcoming.length > 0 ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <h2 className="text-sm font-semibold text-amber-200">Upcoming recurring expenses</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((row) => <div key={row.id} className="flex items-center justify-between gap-2 text-sm text-white/80"><span>{row.item || row.description} · {formatCurrency(row.amount)} · Due {row.nextDueDate}</span><button onClick={() => void createOccurrence(row)} className="shrink-0 rounded-lg bg-amber-400/20 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/30">Create pending</button></div>)}
          </div>
        </div>
      ) : null}

      <TaxTable
        rows={expenses}
        searchKeys={(row) => `${row.description} ${row.category} ${row.date} ${row.status}`}
        filter={{
          label: "Filter",
          options: [
            { value: "deductible", label: "Deductible" },
            { value: "non-deductible", label: "Non-deductible" },
            { value: "no-receipt", label: "No receipt" },
            { value: "Approved", label: "Approved" },
            { value: "Pending", label: "Pending" },
          ],
          match: (row, value) =>
            value === "deductible" ? row.deductible
              : value === "non-deductible" ? !row.deductible
              : value === "no-receipt" ? !row.receipt
              : row.status === value,
        }}
        columns={[
          { key: "description", label: "Expense", render: (row) => <span className="font-medium text-white">{row.description}</span> },
          { key: "category", label: "Category" },
          { key: "date", label: "Date", hideOnMobile: true },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
        ]}
        onRowClick={setDetail}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onExport={(rows) =>
          exportCsv(
            "expenses.csv",
            ["Expense", "Category", "Date", "Amount", "Status"],
            rows.map((row) => [row.description, row.category, row.date, row.amount, row.status]),
          )
        }
        addLabel="New expense"
        onAdd={openCreate}
        empty={{ title: "No expenses recorded", description: "Log business expenses to reduce your taxable profit.", icon: Receipt }}
      />

      <RecordDialog
        open={formOpen}
        title={editing ? "Edit expense" : "New expense"}
        description="Record the expense, category and receipt status."
        submitLabel={editing ? "Update" : "Create"}
        initialValue={editing ? { ...editing } : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        onChange={(value) => setSelectedCategory(str(value.category))}
        fields={[
          { name: "description", label: "Expense", type: "text", required: true, half: true },
          { name: "category", label: "Category", type: "select", options: categories, half: true },
          { name: "item", label: "Item / subcategory", type: "select", options: itemOptions, half: true },
          { name: "date", label: "Date", type: "date", required: true, half: true },
          { name: "amount", label: "Amount", type: "number", required: true, half: true },
          { name: "vatAmount", label: "VAT amount", type: "number", defaultValue: 0, half: true },
          { name: "payee", label: "Payee", type: "text", half: true },
          { name: "supplierId", label: "Supplier", type: "select", options: ["", ...suppliers.map((row: any) => `${row.id} — ${row.name}`)], half: true },
          { name: "paymentMethod", label: "Payment method", type: "select", options: PAYMENT_METHODS, half: true },
          { name: "reference", label: "Reference number", type: "text", half: true },
          { name: "branch", label: "Branch", type: "text", half: true },
          { name: "campaignId", label: "Campaign", type: "select", options: ["", ...campaigns.map((row: any) => `${row.id} — ${row.name}`)], half: true },
          { name: "notes", label: "Notes", type: "text" },
          { name: "attachmentPath", label: "Receipt / attachment", type: "text", half: true },
          { name: "isRecurring", label: "Recurring expense", type: "switch", half: true },
          { name: "frequency", label: "Frequency", type: "select", options: EXPENSE_FREQUENCIES.map((row) => row.value), half: true, showIf: (value) => bool(value.isRecurring) },
          { name: "nextDueDate", label: "Next due date", type: "date", half: true, showIf: (value) => bool(value.isRecurring) },
          { name: "recurringParentId", label: "Recurring parent", type: "select", options: ["", ...expenses.filter((row) => row.isRecurring).map((row) => `${row.id} — ${row.description}`)], half: true, showIf: (value) => bool(value.isRecurring) },
          { name: "status", label: "Status", type: "select", options: ["Approved", "Pending"], half: true },
        ]}
      />

      <DetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.description ?? ""}
        description="Expense details"
        rows={
          detail
            ? [
                { label: "Category", value: detail.category },
                { label: "Date", value: detail.date },
                { label: "Amount", value: formatCurrency(detail.amount) },
                { label: "Deductible", value: detail.deductible ? "Yes" : "No" },
                { label: "Receipt", value: detail.receipt ? "Attached" : "Missing" },
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
        title="Delete expense"
        description={`${pendingDelete?.description ?? ""} will be removed from your expense register.`}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) { deleteExpense(pendingDelete.id); toast.success("Expense deleted"); } }}
      />
    </TaxWorkspace>
  );
}
