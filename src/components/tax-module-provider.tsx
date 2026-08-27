import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SaleRecord = {
  id: string;
  reference: string;
  customer: string;
  date: string;
  amount: number;
  vat: number;
  taxPeriod: string;
  status: "Recorded" | "Pending" | "Reviewed";
};

export type PurchaseRecord = {
  id: string;
  supplier: string;
  date: string;
  amount: number;
  deductible: boolean;
  category: string;
  attachment: boolean;
  taxPeriod: string;
  status: "Verified" | "Pending";
};

export type ExpenseRecord = {
  id: string;
  description: string;
  category: string;
  item: string;
  date: string;
  amount: number;
  vatAmount: number;
  payee: string;
  supplierId: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  attachmentPath: string;
  branch: string;
  campaignId: string;
  isRecurring: boolean;
  frequency: string;
  nextDueDate: string;
  recurringParentId: string;
  deductible: boolean;
  receipt: boolean;
  taxPeriod: string;
  status: "Approved" | "Pending";
};

export type VatReturnRecord = {
  id: string;
  period: string;
  outputVat: number;
  inputVat: number;
  payable: number;
  dueDate: string;
  paymentStatus: "Paid" | "Unpaid" | "Partial";
  status: "Filed" | "Draft" | "Pending";
};

export type WithholdingRecord = {
  id: string;
  name: string;
  certificate: string;
  type: string;
  date: string;
  period: string;
  dueDate: string;
  amount: number;
  paymentStatus: "Paid" | "Unpaid";
  status: "Issued" | "Received" | "Pending";
};

export type PayeRecord = {
  id: string;
  period: string;
  employees: number;
  grossPay: number;
  payeAmount: number;
  dueDate: string;
  paymentStatus: "Paid" | "Unpaid";
  status: "Filed" | "Draft" | "Pending";
};

export type IncomeTaxRecord = {
  id: string;
  period: string;
  installment: string;
  profitBase: number;
  taxRate: number;
  amount: number;
  dueDate: string;
  paymentStatus: "Paid" | "Unpaid";
  status: "Filed" | "Draft" | "Pending";
};

export type AssetRecord = {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseValue: number;
  currentValue: number;
  depreciation: number;
  usefulLife: number;
  status: "Active" | "Disposed";
};

export type DocumentRecord = {
  id: string;
  name: string;
  category: string;
  type: string;
  size: string;
  status: "Verified" | "Pending";
  uploadedAt: string;
  filePath: string;
  saleId: string;
};

export const DOCUMENT_CATEGORIES = [
  "EFD Receipts",
  "Receipts",
  "Invoices",
  "Certificates",
  "Returns",
  "Other",
] as const;

export type ImportLog = {
  id: string;
  name: string;
  type: string;
  rows: number;
  duplicates: number;
  errors: number;
  status: "Completed" | "Errors" | "Review";
  importedAt: string;
};

export type ObligationStatus = "Upcoming" | "Pending" | "Paid" | "Overdue";

export type TaxObligation = {
  id: string;
  taxType: "VAT" | "Income Tax" | "Withholding Tax" | "PAYE";
  reference: string;
  period: string;
  dueDate: string;
  amount: number;
  status: ObligationStatus;
  filingStatus: string;
  daysLeft: number;
  reminderStage: 7 | 3 | 1 | null;
  reminderOn: boolean;
  sourceRoute: string;
  sourceLabel: string;
};

type Metrics = {
  salesTotal: number;
  salesVat: number;
  purchaseTotal: number;
  purchaseDeduction: number;
  expenseTotal: number;
  deductibleExpenses: number;
  outputVat: number;
  inputVat: number;
  vatPayable: number;
  currentProfit: number;
  projectedProfit: number;
  estimatedTax: number;
  complianceScore: number;
  riskLevel: "Low" | "Medium" | "High";
  dueSoon: number;
  overdue: number;
};

export type TaxModuleContextValue = {
  loading: boolean;
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  expenses: ExpenseRecord[];
  vatReturns: VatReturnRecord[];
  withholding: WithholdingRecord[];
  paye: PayeRecord[];
  incomeTax: IncomeTaxRecord[];
  assets: AssetRecord[];
  documents: DocumentRecord[];
  imports: ImportLog[];
  taxRate: number;
  setTaxRate: (rate: number) => void;
  projectedAnnualProfit: number;
  setProjectedAnnualProfit: (value: number) => void;
  /** Days before a due date at which an obligation is treated as "due soon". */
  dueSoonDays: number;
  setDueSoonDays: (value: number) => void;

  saveSale: (record: Omit<SaleRecord, "id">, id?: string) => void;
  saveSaleWithReceipt: (record: Omit<SaleRecord, "id">, receipt: File, id?: string) => Promise<void>;
  deleteSale: (id: string) => void;
  savePurchase: (record: Omit<PurchaseRecord, "id">, id?: string) => void;
  deletePurchase: (id: string) => void;
  saveExpense: (record: Omit<ExpenseRecord, "id">, id?: string) => void;
  deleteExpense: (id: string) => void;
  saveVatReturn: (record: Omit<VatReturnRecord, "id">, id?: string) => void;
  deleteVatReturn: (id: string) => void;
  saveWithholding: (record: Omit<WithholdingRecord, "id">, id?: string) => void;
  deleteWithholding: (id: string) => void;
  savePaye: (record: Omit<PayeRecord, "id">, id?: string) => void;
  deletePaye: (id: string) => void;
  saveIncomeTax: (record: Omit<IncomeTaxRecord, "id">, id?: string) => void;
  deleteIncomeTax: (id: string) => void;
  saveAsset: (record: Omit<AssetRecord, "id">, id?: string) => void;
  deleteAsset: (id: string) => void;
  saveDocument: (record: Omit<DocumentRecord, "id">, id?: string) => void;
  deleteDocument: (id: string) => void;
  uploadDocument: (file: File, options: { category: string; name?: string; saleId?: string }) => Promise<DocumentRecord | null>;
  documentUrl: (doc: DocumentRecord) => Promise<string | null>;
  refresh: () => Promise<void>;
  addImport: (record: Omit<ImportLog, "id">) => void;
  deleteImport: (id: string) => void;
  obligations: TaxObligation[];
  toggleReminder: (id: string, on: boolean) => void;
  markObligationPaid: (obligation: TaxObligation) => void;
  metrics: Metrics;
};

const TaxModuleContext = createContext<TaxModuleContextValue | null>(null);

/* ------------------------------ date helpers ------------------------------ */

export function periodOf(date: string) {
  return date.slice(0, 7);
}

/** VAT and PAYE are due on the 20th of the month following the tax period. */
export function dueDateForPeriod(period: string, day = 20) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  const next = new Date(Date.UTC(year, month, day));
  return next.toISOString().slice(0, 10);
}

const DUE_SOON_KEY = "bizz.tax.dueSoonDays";

export function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function obligationStatus(dueDate: string, paid: boolean, dueSoonDays = 7): ObligationStatus {
  if (paid) return "Paid";
  const left = daysUntil(dueDate);
  if (left < 0) return "Overdue";
  if (left <= dueSoonDays) return "Pending";
  return "Upcoming";
}


function reminderStage(daysLeft: number, paid: boolean): 7 | 3 | 1 | null {
  if (paid || daysLeft < 0) return null;
  if (daysLeft <= 1) return 1;
  if (daysLeft <= 3) return 3;
  if (daysLeft <= 7) return 7;
  return null;
}

/* ------------------------------- row mappers ------------------------------ */

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));

const mapSale = (r: any): SaleRecord => ({
  id: r.id, reference: str(r.reference), customer: str(r.customer), date: str(r.date),
  amount: num(r.amount), vat: num(r.vat), taxPeriod: str(r.tax_period), status: r.status,
});
const saleRow = (r: Omit<SaleRecord, "id">) => ({
  reference: r.reference, customer: r.customer, date: r.date, amount: r.amount,
  vat: r.vat, tax_period: r.taxPeriod, status: r.status,
});

const mapPurchase = (r: any): PurchaseRecord => ({
  id: r.id, supplier: str(r.supplier), date: str(r.date), amount: num(r.amount),
  deductible: !!r.deductible, category: str(r.category), attachment: !!r.attachment,
  taxPeriod: str(r.tax_period), status: r.status,
});
const purchaseRow = (r: Omit<PurchaseRecord, "id">) => ({
  supplier: r.supplier, date: r.date, amount: r.amount, deductible: r.deductible,
  category: r.category, attachment: r.attachment, tax_period: r.taxPeriod, status: r.status,
});

const mapExpense = (r: any): ExpenseRecord => ({
  id: r.id, description: str(r.description), category: str(r.category), item: str(r.item), date: str(r.date),
  amount: num(r.amount), vatAmount: num(r.vat_amount), payee: str(r.payee), supplierId: str(r.supplier_id),
  paymentMethod: str(r.payment_method), reference: str(r.reference), notes: str(r.notes),
  attachmentPath: str(r.attachment_path), branch: str(r.branch), campaignId: str(r.campaign_id),
  isRecurring: !!r.is_recurring, frequency: str(r.frequency || "one_time"), nextDueDate: str(r.next_due_date),
  recurringParentId: str(r.recurring_parent_id), deductible: !!r.deductible, receipt: !!r.receipt,
  taxPeriod: str(r.tax_period), status: r.status,
});
const expenseRow = (r: Omit<ExpenseRecord, "id">) => ({
  description: r.description, category: r.category, item: r.item || null, date: r.date, amount: r.amount,
  vat_amount: r.vatAmount, payee: r.payee || null, supplier_id: r.supplierId || null,
  payment_method: r.paymentMethod || null, reference: r.reference || null, notes: r.notes || null,
  attachment_path: r.attachmentPath || null, branch: r.branch || null, campaign_id: r.campaignId || null,
  is_recurring: r.isRecurring, frequency: r.frequency || "one_time", next_due_date: r.nextDueDate || null,
  recurring_parent_id: r.recurringParentId || null,
  deductible: r.deductible, receipt: r.receipt, tax_period: r.taxPeriod, status: r.status,
});

const mapVat = (r: any): VatReturnRecord => ({
  id: r.id, period: str(r.period), outputVat: num(r.output_vat), inputVat: num(r.input_vat),
  payable: num(r.payable), dueDate: str(r.due_date), paymentStatus: r.payment_status, status: r.status,
});
const vatRow = (r: Omit<VatReturnRecord, "id">) => ({
  period: r.period, output_vat: r.outputVat, input_vat: r.inputVat, payable: r.payable,
  due_date: r.dueDate, payment_status: r.paymentStatus, status: r.status,
});

const mapWht = (r: any): WithholdingRecord => ({
  id: r.id, name: str(r.name), certificate: str(r.certificate), type: str(r.type),
  date: str(r.date), period: str(r.period), dueDate: str(r.due_date), amount: num(r.amount),
  paymentStatus: r.payment_status, status: r.status,
});
const whtRow = (r: Omit<WithholdingRecord, "id">) => ({
  name: r.name, certificate: r.certificate, type: r.type, date: r.date, period: r.period,
  due_date: r.dueDate, amount: r.amount, payment_status: r.paymentStatus, status: r.status,
});

const mapPaye = (r: any): PayeRecord => ({
  id: r.id, period: str(r.period), employees: num(r.employees), grossPay: num(r.gross_pay),
  payeAmount: num(r.paye_amount), dueDate: str(r.due_date), paymentStatus: r.payment_status, status: r.status,
});
const payeRow = (r: Omit<PayeRecord, "id">) => ({
  period: r.period, employees: r.employees, gross_pay: r.grossPay, paye_amount: r.payeAmount,
  due_date: r.dueDate, payment_status: r.paymentStatus, status: r.status,
});

const mapIncome = (r: any): IncomeTaxRecord => ({
  id: r.id, period: str(r.period), installment: str(r.installment), profitBase: num(r.profit_base),
  taxRate: num(r.tax_rate), amount: num(r.amount), dueDate: str(r.due_date),
  paymentStatus: r.payment_status, status: r.status,
});
const incomeRow = (r: Omit<IncomeTaxRecord, "id">) => ({
  period: r.period, installment: r.installment, profit_base: r.profitBase, tax_rate: r.taxRate,
  amount: r.amount, due_date: r.dueDate, payment_status: r.paymentStatus, status: r.status,
});

const mapAsset = (r: any): AssetRecord => ({
  id: r.id, name: str(r.name), category: str(r.category), purchaseDate: str(r.purchase_date),
  purchaseValue: num(r.purchase_value), currentValue: num(r.current_value),
  depreciation: num(r.depreciation), usefulLife: num(r.useful_life), status: r.status,
});
const assetRow = (r: Omit<AssetRecord, "id">) => ({
  name: r.name, category: r.category, purchase_date: r.purchaseDate, purchase_value: r.purchaseValue,
  current_value: r.currentValue, depreciation: r.depreciation, useful_life: r.usefulLife, status: r.status,
});

export const BUCKET = "tax-documents";

export function humanSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(file: File) {
  const type = file.type || "";
  if (type.startsWith("image/")) return "Image";
  if (type === "application/pdf") return "PDF";
  if (type.includes("sheet") || type.includes("excel") || file.name.endsWith(".csv")) return "Excel";
  if (type.includes("word")) return "Word";
  return "Other";
}

const mapDocument = (r: any): DocumentRecord => ({
  id: r.id, name: str(r.name), category: str(r.category), type: str(r.type),
  size: str(r.size), status: r.status, uploadedAt: str(r.uploaded_at),
  filePath: str(r.file_path), saleId: str(r.sale_id),
});
const documentRow = (r: Omit<DocumentRecord, "id">) => ({
  name: r.name, category: r.category, type: r.type, size: r.size, status: r.status,
  uploaded_at: r.uploadedAt, file_path: r.filePath || null, sale_id: r.saleId || null,
});

const mapImport = (r: any): ImportLog => ({
  id: r.id, name: str(r.name), type: str(r.type), rows: num(r.rows_count),
  duplicates: num(r.duplicates), errors: num(r.errors), status: r.status, importedAt: str(r.imported_at),
});
const importRow = (r: Omit<ImportLog, "id">) => ({
  name: r.name, type: r.type, rows_count: r.rows, duplicates: r.duplicates,
  errors: r.errors, status: r.status, imported_at: r.importedAt,
});

/* -------------------------------- provider -------------------------------- */

export function TaxModuleProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [vatReturns, setVatReturns] = useState<VatReturnRecord[]>([]);
  const [withholding, setWithholding] = useState<WithholdingRecord[]>([]);
  const [paye, setPaye] = useState<PayeRecord[]>([]);
  const [incomeTax, setIncomeTax] = useState<IncomeTaxRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [imports, setImports] = useState<ImportLog[]>([]);
  const [remindersOff, setRemindersOff] = useState<string[]>([]);
  const [taxRate, setTaxRateState] = useState(30);
  const [projectedAnnualProfit, setProjectedProfitState] = useState(0);
  const [dueSoonDays, setDueSoonDaysState] = useState(() => {
    if (typeof window === "undefined") return 7;
    const stored = Number(window.localStorage.getItem(DUE_SOON_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 7;
  });

  const refresh = useCallback(async () => {
    const [s, p, e, v, w, py, it, a, d, im, st] = await Promise.all([
      supabase.from("tax_sales").select("*").order("date", { ascending: false }),
      supabase.from("tax_purchases").select("*").order("date", { ascending: false }),
      supabase.from("tax_expenses").select("*").order("date", { ascending: false }),
      supabase.from("vat_returns").select("*").order("period", { ascending: false }),
      supabase.from("withholding_records").select("*").order("date", { ascending: false }),
      supabase.from("paye_records").select("*").order("period", { ascending: false }),
      supabase.from("income_tax_records").select("*").order("due_date"),
      supabase.from("capital_assets").select("*").order("purchase_date", { ascending: false }),
      supabase.from("tax_documents").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("tax_imports").select("*").order("imported_at", { ascending: false }),
      supabase.from("tax_settings").select("*").maybeSingle(),
    ]);
    setSales((s.data ?? []).map(mapSale));
    setPurchases((p.data ?? []).map(mapPurchase));
    setExpenses((e.data ?? []).map(mapExpense));
    setVatReturns((v.data ?? []).map(mapVat));
    setWithholding((w.data ?? []).map(mapWht));
    setPaye((py.data ?? []).map(mapPaye));
    setIncomeTax((it.data ?? []).map(mapIncome));
    setAssets((a.data ?? []).map(mapAsset));
    setDocuments((d.data ?? []).map(mapDocument));
    setImports((im.data ?? []).map(mapImport));
    if (st.data) {
      setTaxRateState(Number(st.data.tax_rate ?? 30));
      setProjectedProfitState(Number(st.data.projected_annual_profit ?? 0));
      setRemindersOff(st.data.reminders_off ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSetting = useCallback(async (patch: Record<string, unknown>) => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? "00000000-0000-0000-0000-000000000000";
    await supabase.from("tax_settings").upsert({ user_id: userId, ...patch } as any);
  }, []);

  const setTaxRate = useCallback((rate: number) => {
    setTaxRateState(rate);
    void saveSetting({ tax_rate: rate });
  }, [saveSetting]);

  const setDueSoonDays = useCallback((value: number) => {
    const next = Number.isFinite(value) && value > 0 ? Math.round(value) : 7;
    setDueSoonDaysState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(DUE_SOON_KEY, String(next));
  }, []);

  const setProjectedAnnualProfit = useCallback((value: number) => {
    setProjectedProfitState(value);
    void saveSetting({ projected_annual_profit: value });
  }, [saveSetting]);

  const makeSave = useCallback(
    <T,>(table: string, toRow: (record: T) => Record<string, unknown>) =>
      (record: T, id?: string) => {
        void (async () => {
          if (id) await supabase.from(table as any).update(toRow(record) as any).eq("id", id);
          else await supabase.from(table as any).insert(toRow(record) as any);
          await refresh();
        })();
      },
    [refresh],
  );

  const makeDelete = useCallback(
    (table: string) => (id: string) => {
      void (async () => {
        await supabase.from(table as any).delete().eq("id", id);
        await refresh();
      })();
    },
    [refresh],
  );

  const obligations = useMemo<TaxObligation[]>(() => {
    const build = (
      id: string,
      taxType: TaxObligation["taxType"],
      reference: string,
      period: string,
      dueDate: string,
      amount: number,
      paid: boolean,
      filingStatus: string,
      sourceRoute: string,
      sourceLabel: string,
    ): TaxObligation => {
      const daysLeft = daysUntil(dueDate);
      return {
        id, taxType, reference, period, dueDate, amount,
        status: obligationStatus(dueDate, paid, dueSoonDays),
        filingStatus,
        daysLeft,
        reminderStage: reminderStage(daysLeft, paid),
        reminderOn: !remindersOff.includes(id),
        sourceRoute, sourceLabel,
      };
    };

    const items: TaxObligation[] = [
      ...vatReturns.map((row) =>
        build(`vat-${row.id}`, "VAT", `VAT return ${row.period}`, row.period, row.dueDate, row.payable,
          row.paymentStatus === "Paid", row.status, "/m/tax/vat", "VAT Returns")),
      ...paye.map((row) =>
        build(`paye-${row.id}`, "PAYE", `PAYE ${row.period}`, row.period, row.dueDate, row.payeAmount,
          row.paymentStatus === "Paid", row.status, "/m/tax/withholding", "PAYE Returns")),
      ...withholding.map((row) =>
        build(`wht-${row.id}`, "Withholding Tax", row.certificate, row.period, row.dueDate, row.amount,
          row.paymentStatus === "Paid", row.status, "/m/tax/withholding", "Withholding Tax")),
      ...incomeTax.map((row) =>
        build(`cit-${row.id}`, "Income Tax", `${row.installment} ${row.period}`, row.period, row.dueDate, row.amount,
          row.paymentStatus === "Paid", row.status, "/m/tax/income", "Income Tax")),
    ];

    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [vatReturns, paye, withholding, incomeTax, remindersOff, dueSoonDays]);

  const metrics = useMemo<Metrics>(() => {
    const toNumber = (value: number | null | undefined) => Number.isFinite(value as number) ? Number(value ?? 0) : 0;

    const salesTotal = sales.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const salesVat = sales.reduce((sum, item) => sum + toNumber(item.vat), 0);
    const purchaseTotal = purchases.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const purchaseDeduction = purchases.filter((item) => item.deductible).reduce((sum, item) => sum + toNumber(item.amount), 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const deductibleExpenses = expenses.filter((item) => item.deductible).reduce((sum, item) => sum + toNumber(item.amount), 0);
    const depreciationTotal = assets.reduce((sum, item) => sum + toNumber(item.depreciation), 0);
    const outputVat = salesVat;
    const inputVat = purchases.reduce((sum, item) => sum + (item.deductible ? toNumber(item.amount) * 0.18 : 0), 0);
    const vatPayable = Math.max(0, outputVat - inputVat);
    const currentProfit = salesTotal - purchaseTotal - expenseTotal - depreciationTotal;
    const projectedProfit = projectedAnnualProfit || currentProfit * 1.25;
    const estimatedTax = projectedProfit * (taxRate / 100);

    const documented = documents.filter((item) => item.status === "Verified").length;
    const docScore = documents.length ? (documented / documents.length) * 25 : 0;
    const receiptScore = expenses.length ? (expenses.filter((item) => item.receipt).length / expenses.length) * 25 : 0;
    const filedScore = vatReturns.length ? (vatReturns.filter((item) => item.status === "Filed").length / vatReturns.length) * 25 : 0;
    const overdue = obligations.filter((item) => item.status === "Overdue").length;
    const dueSoon = obligations.filter((item) => item.status === "Pending").length;
    const calendarScore = obligations.length ? ((obligations.length - overdue) / obligations.length) * 25 : 25;
    const complianceScore = Math.round(docScore + receiptScore + filedScore + calendarScore);
    const riskLevel: Metrics["riskLevel"] = overdue > 0 ? "High" : complianceScore >= 80 ? "Low" : complianceScore >= 55 ? "Medium" : "High";

    return {
      salesTotal, salesVat, purchaseTotal, purchaseDeduction, expenseTotal, deductibleExpenses,
      outputVat, inputVat, vatPayable, currentProfit, projectedProfit, estimatedTax,
      complianceScore, riskLevel, dueSoon, overdue,
    };
  }, [sales, purchases, expenses, assets, documents, vatReturns, obligations, taxRate, projectedAnnualProfit]);

  const markObligationPaid = useCallback((obligation: TaxObligation) => {
    const rawId = obligation.id.slice(obligation.id.indexOf("-") + 1);
    void (async () => {
      if (obligation.taxType === "VAT") {
        await supabase.from("vat_returns").update({ payment_status: "Paid", status: "Filed" }).eq("id", rawId);
      } else if (obligation.taxType === "PAYE") {
        await supabase.from("paye_records").update({ payment_status: "Paid", status: "Filed" }).eq("id", rawId);
      } else if (obligation.taxType === "Withholding Tax") {
        await supabase.from("withholding_records").update({ payment_status: "Paid" }).eq("id", rawId);
      } else {
        await supabase.from("income_tax_records").update({ payment_status: "Paid", status: "Filed" }).eq("id", rawId);
      }
      await refresh();
    })();
  }, [refresh]);

  const toggleReminder = useCallback((id: string, on: boolean) => {
    setRemindersOff((current) => {
      const next = on ? current.filter((item) => item !== id) : Array.from(new Set([...current, id]));
      void saveSetting({ reminders_off: next });
      return next;
    });
  }, [saveSetting]);

  const uploadDocument = useCallback(
    async (file: File, options: { category: string; name?: string; saleId?: string }) => {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const path = `${options.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("tax_documents")
        .insert(
          documentRow({
            name: options.name || file.name,
            category: options.category,
            type: fileKind(file),
            size: humanSize(file.size),
            status: "Pending",
            uploadedAt: new Date().toISOString().slice(0, 10),
            filePath: path,
            saleId: options.saleId ?? "",
          }) as any,
        )
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data ? mapDocument(data) : null;
    },
    [refresh],
  );

  const documentUrl = useCallback(async (doc: DocumentRecord) => {
    if (!doc.filePath) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.filePath, 60 * 60);
    return data?.signedUrl ?? null;
  }, []);

  const deleteDocument = useCallback(
    (id: string) => {
      void (async () => {
        const doc = documents.find((row) => row.id === id);
        if (doc?.filePath) await supabase.storage.from(BUCKET).remove([doc.filePath]);
        await supabase.from("tax_documents").delete().eq("id", id);
        await refresh();
      })();
    },
    [documents, refresh],
  );

  const saveSaleWithReceipt = useCallback(
    async (record: Omit<SaleRecord, "id">, receipt: File, id?: string) => {
      let saleId = id;
      if (id) {
        await supabase.from("tax_sales").update(saleRow(record) as any).eq("id", id);
      } else {
        const { data, error } = await supabase.from("tax_sales").insert(saleRow(record) as any).select().single();
        if (error) throw error;
        saleId = (data as any)?.id;
      }
      await uploadDocument(receipt, {
        category: "EFD Receipts",
        name: `Receipt ${record.reference} — ${record.customer}`,
        saleId,
      });
      await refresh();
    },
    [refresh, uploadDocument],
  );

  const value: TaxModuleContextValue = {
    loading,
    sales, purchases, expenses, vatReturns, withholding, paye, incomeTax, assets, documents, imports,
    taxRate, setTaxRate, projectedAnnualProfit, setProjectedAnnualProfit,
    dueSoonDays, setDueSoonDays,
    saveSale: makeSave("tax_sales", saleRow),
    saveSaleWithReceipt,
    deleteSale: makeDelete("tax_sales"),
    savePurchase: makeSave("tax_purchases", purchaseRow),
    deletePurchase: makeDelete("tax_purchases"),
    saveExpense: makeSave("tax_expenses", expenseRow),
    deleteExpense: makeDelete("tax_expenses"),
    saveVatReturn: makeSave("vat_returns", vatRow),
    deleteVatReturn: makeDelete("vat_returns"),
    saveWithholding: makeSave("withholding_records", whtRow),
    deleteWithholding: makeDelete("withholding_records"),
    savePaye: makeSave("paye_records", payeRow),
    deletePaye: makeDelete("paye_records"),
    saveIncomeTax: makeSave("income_tax_records", incomeRow),
    deleteIncomeTax: makeDelete("income_tax_records"),
    saveAsset: makeSave("capital_assets", assetRow),
    deleteAsset: makeDelete("capital_assets"),
    saveDocument: makeSave("tax_documents", documentRow),
    deleteDocument,
    uploadDocument,
    documentUrl,
    refresh,
    addImport: (record) => makeSave("tax_imports", importRow)(record),
    deleteImport: makeDelete("tax_imports"),
    obligations,
    toggleReminder,
    markObligationPaid,
    metrics,
  };

  return <TaxModuleContext.Provider value={value}>{children}</TaxModuleContext.Provider>;
}

export function useTaxModule() {
  const ctx = useContext(TaxModuleContext);
  if (!ctx) throw new Error("useTaxModule must be used inside TaxModuleProvider");
  return ctx;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(value);
}
