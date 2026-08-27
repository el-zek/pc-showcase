import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

/* --------------------------------- types ---------------------------------- */

export type AccountRecord = {
  id: string;
  name: string;
  accountType: string;
  paymentMethod: string;
  accountNumber: string;
  currency: string;
  openingBalance: number;
  status: "Active" | "Inactive";
  notes: string;
};

export type FinancePaymentRecord = {
  id: string;
  paymentType: string;
  paymentMethod: string;
  accountId: string;
  direction: "in" | "out";
  amount: number;
  paymentDate: string;
  reference: string;
  customerId: string;
  customerName: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  attachmentPath: string;
  description: string;
  notes: string;
  status: "Completed" | "Pending" | "Cancelled";
};

export type TransferRecord = {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  transferDate: string;
  reference: string;
  description: string;
  notes: string;
  status: "Completed" | "Pending" | "Cancelled";
};

export type AuditRecord = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  description: string;
  amount: number;
  createdAt: string;
};

export const ACCOUNT_TYPES = ["Bank", "Cash", "Mobile Money", "Petty Cash", "Other"] as const;

export const PAYMENT_TYPES = [
  "Customer Payment",
  "Supplier Payment",
  "Purchase Payment",
  "Expense Payment",
  "Salary Payment",
  "Loan Payment",
  "Tax Payment",
  "Subscription Payment",
  "Deposit",
  "Withdrawal",
  "Refund",
  "Manual Payment",
  "Other",
] as const;

export const MONEY_IN = "Money In";
export const MONEY_OUT = "Money Out";

/** Money direction implied by a payment type — used to prefill the form. */
export function directionForType(type: string): "in" | "out" {
  return type === "Customer Payment" || type === "Deposit" ? "in" : "out";
}

export const formatMoney = (value: number) => money(value);

/* ------------------------------- row mappers ------------------------------ */

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));

const mapAccount = (r: any): AccountRecord => ({
  id: r.id,
  name: str(r.name),
  accountType: str(r.account_type),
  paymentMethod: str(r.payment_method),
  accountNumber: str(r.account_number),
  currency: str(r.currency) || "TZS",
  openingBalance: num(r.opening_balance),
  status: r.status,
  notes: str(r.notes),
});
const accountRow = (r: Omit<AccountRecord, "id">) => ({
  name: r.name,
  account_type: r.accountType,
  payment_method: r.paymentMethod || r.name,
  account_number: r.accountNumber || null,
  currency: r.currency || "TZS",
  opening_balance: r.openingBalance,
  status: r.status,
  notes: r.notes || null,
});

const mapPayment = (r: any): FinancePaymentRecord => ({
  id: r.id,
  paymentType: str(r.payment_type),
  paymentMethod: str(r.payment_method),
  accountId: str(r.account_id),
  direction: r.direction === "in" ? "in" : "out",
  amount: num(r.amount),
  paymentDate: str(r.payment_date),
  reference: str(r.reference),
  customerId: str(r.customer_id),
  customerName: str(r.customer_name),
  supplierId: str(r.supplier_id),
  supplierName: str(r.supplier_name),
  invoiceNumber: str(r.invoice_number),
  attachmentPath: str(r.attachment_path),
  description: str(r.description),
  notes: str(r.notes),
  status: r.status,
});
const paymentRow = (r: Omit<FinancePaymentRecord, "id">) => ({
  payment_type: r.paymentType,
  payment_method: r.paymentMethod,
  account_id: r.accountId || null,
  direction: r.direction,
  amount: r.amount,
  payment_date: r.paymentDate,
  reference: r.reference || null,
  customer_id: r.customerId || null,
  customer_name: r.customerName || null,
  supplier_id: r.supplierId || null,
  supplier_name: r.supplierName || null,
  invoice_number: r.invoiceNumber || null,
  attachment_path: r.attachmentPath || null,
  description: r.description || null,
  notes: r.notes || null,
  status: r.status,
});

const mapTransfer = (r: any): TransferRecord => ({
  id: r.id,
  fromAccountId: str(r.from_account_id),
  fromAccountName: str(r.from_account_name),
  toAccountId: str(r.to_account_id),
  toAccountName: str(r.to_account_name),
  amount: num(r.amount),
  transferDate: str(r.transfer_date),
  reference: str(r.reference),
  description: str(r.description),
  notes: str(r.notes),
  status: r.status,
});
const transferRow = (r: Omit<TransferRecord, "id">) => ({
  from_account_id: r.fromAccountId || null,
  from_account_name: r.fromAccountName,
  to_account_id: r.toAccountId || null,
  to_account_name: r.toAccountName,
  amount: r.amount,
  transfer_date: r.transferDate,
  reference: r.reference || null,
  description: r.description || null,
  notes: r.notes || null,
  status: r.status,
});

const mapAudit = (r: any): AuditRecord => ({
  id: r.id,
  entity: str(r.entity),
  entityId: str(r.entity_id),
  action: str(r.action),
  description: str(r.description),
  amount: num(r.amount),
  createdAt: str(r.created_at),
});

/* -------------------------------- context --------------------------------- */

export type AccountWithBalance = AccountRecord & { currentBalance: number; movement: number };

type FinanceContextValue = {
  loading: boolean;
  accounts: AccountWithBalance[];
  payments: FinancePaymentRecord[];
  transfers: TransferRecord[];
  audit: AuditRecord[];
  paymentMethods: string[];
  accountName: (id: string) => string;
  saveAccount: (record: Omit<AccountRecord, "id">, id?: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  savePayment: (record: Omit<FinancePaymentRecord, "id">, id?: string, attachment?: File | null) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  saveTransfer: (record: Omit<TransferRecord, "id">, id?: string) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  metrics: {
    totalBalance: number;
    moneyIn: number;
    moneyOut: number;
    netCash: number;
    transferTotal: number;
    activeAccounts: number;
  };
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<AccountRecord[]>([]);
  const [payments, setPayments] = useState<FinancePaymentRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);

  const refresh = useCallback(async () => {
    const [a, p, t, l] = await Promise.all([
      supabase.from("finance_accounts").select("*").order("name"),
      supabase.from("finance_payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("finance_transfers").select("*").order("transfer_date", { ascending: false }),
      supabase.from("finance_audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setRawAccounts((a.data ?? []).map(mapAccount));
    setPayments((p.data ?? []).map(mapPayment));
    setTransfers((t.data ?? []).map(mapTransfer));
    setAudit((l.data ?? []).map(mapAudit));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const log = useCallback(async (entity: string, action: string, description: string, amount: number, entityId?: string) => {
    await supabase.from("finance_audit_logs").insert({
      entity,
      action,
      description,
      amount,
      entity_id: entityId ?? null,
    } as any);
  }, []);

  /** Balances are derived from completed payments and transfers, so they never drift. */
  const accounts = useMemo<AccountWithBalance[]>(() => {
    return rawAccounts.map((account) => {
      let movement = 0;
      payments.forEach((row) => {
        if (row.status !== "Completed" || row.accountId !== account.id) return;
        movement += row.direction === "in" ? row.amount : -row.amount;
      });
      transfers.forEach((row) => {
        if (row.status !== "Completed") return;
        if (row.fromAccountId === account.id) movement -= row.amount;
        if (row.toAccountId === account.id) movement += row.amount;
      });
      return { ...account, movement, currentBalance: account.openingBalance + movement };
    });
  }, [rawAccounts, payments, transfers]);

  const accountName = useCallback(
    (id: string) => accounts.find((row) => row.id === id)?.name ?? "—",
    [accounts],
  );

  const paymentMethods = useMemo(
    () => [...new Set(accounts.filter((row) => row.status === "Active").map((row) => row.paymentMethod || row.name))],
    [accounts],
  );

  const saveAccount = useCallback(async (record: Omit<AccountRecord, "id">, id?: string) => {
    if (id) await supabase.from("finance_accounts").update(accountRow(record) as any).eq("id", id);
    else await supabase.from("finance_accounts").insert(accountRow(record) as any);
    await log("account", id ? "update" : "create", record.name, record.openingBalance, id);
    await refresh();
  }, [log, refresh]);

  const deleteAccount = useCallback(async (id: string) => {
    const target = rawAccounts.find((row) => row.id === id);
    await supabase.from("finance_accounts").delete().eq("id", id);
    await log("account", "delete", target?.name ?? "", 0, id);
    await refresh();
  }, [log, refresh, rawAccounts]);

  const savePayment = useCallback(async (record: Omit<FinancePaymentRecord, "id">, id?: string, attachment?: File | null) => {
    let attachmentPath = record.attachmentPath;
    if (attachment) {
      const { data } = await supabase.auth.getUser();
      const path = `${data.user?.id ?? "anon"}/finance/${Date.now()}-${attachment.name}`;
      const upload = await supabase.storage.from("tax-documents").upload(path, attachment);
      if (!upload.error) attachmentPath = path;
    }
    const row = paymentRow({ ...record, attachmentPath });
    if (id) await supabase.from("finance_payments").update(row as any).eq("id", id);
    else await supabase.from("finance_payments").insert(row as any);
    await log("payment", id ? "update" : "create", `${record.paymentType} · ${record.paymentMethod}`, record.amount, id);
    await refresh();
  }, [log, refresh]);

  const deletePayment = useCallback(async (id: string) => {
    const target = payments.find((row) => row.id === id);
    await supabase.from("finance_payments").delete().eq("id", id);
    await log("payment", "delete", target?.paymentType ?? "", target?.amount ?? 0, id);
    await refresh();
  }, [log, refresh, payments]);

  const saveTransfer = useCallback(async (record: Omit<TransferRecord, "id">, id?: string) => {
    if (id) await supabase.from("finance_transfers").update(transferRow(record) as any).eq("id", id);
    else await supabase.from("finance_transfers").insert(transferRow(record) as any);
    await log("transfer", id ? "update" : "create", `${record.fromAccountName} → ${record.toAccountName}`, record.amount, id);
    await refresh();
  }, [log, refresh]);

  const deleteTransfer = useCallback(async (id: string) => {
    const target = transfers.find((row) => row.id === id);
    await supabase.from("finance_transfers").delete().eq("id", id);
    await log("transfer", "delete", target ? `${target.fromAccountName} → ${target.toAccountName}` : "", target?.amount ?? 0, id);
    await refresh();
  }, [log, refresh, transfers]);

  const metrics = useMemo(() => {
    const completed = payments.filter((row) => row.status === "Completed");
    const moneyIn = completed.filter((row) => row.direction === "in").reduce((a, r) => a + r.amount, 0);
    const moneyOut = completed.filter((row) => row.direction === "out").reduce((a, r) => a + r.amount, 0);
    return {
      totalBalance: accounts.reduce((a, r) => a + r.currentBalance, 0),
      moneyIn,
      moneyOut,
      netCash: moneyIn - moneyOut,
      transferTotal: transfers.filter((row) => row.status === "Completed").reduce((a, r) => a + r.amount, 0),
      activeAccounts: accounts.filter((row) => row.status === "Active").length,
    };
  }, [accounts, payments, transfers]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      loading,
      accounts,
      payments,
      transfers,
      audit,
      paymentMethods,
      accountName,
      saveAccount,
      deleteAccount,
      savePayment,
      deletePayment,
      saveTransfer,
      deleteTransfer,
      refresh,
      metrics,
    }),
    [loading, accounts, payments, transfers, audit, paymentMethods, accountName, saveAccount, deleteAccount, savePayment, deletePayment, saveTransfer, deleteTransfer, refresh, metrics],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used inside FinanceProvider");
  return context;
}
