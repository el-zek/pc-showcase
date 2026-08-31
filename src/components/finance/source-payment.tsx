import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RecordDialog, num, str, type FieldValue } from "@/components/tax/record-dialog";
import { PAYMENT_METHODS } from "@/lib/expense-catalog";
import {
  fetchLinkedPayments, sumCompleted, withLink, type LinkedPayment, type PaymentSourceType,
} from "@/lib/finance-link";

export type PayState = "Unpaid" | "Partially Paid" | "Paid";

export function payStateOf(total: number, paid: number): PayState {
  if (paid <= 0) return "Unpaid";
  return paid + 0.005 >= total ? "Paid" : "Partially Paid";
}

/** Payments actually made against one business event (sale, purchase, expense). */
export function useSourcePayments(type: PaymentSourceType, id: string, total: number) {
  const [payments, setPayments] = useState<LinkedPayment[]>([]);

  const reload = useCallback(async () => {
    setPayments(id ? await fetchLinkedPayments(type, id) : []);
  }, [type, id]);

  useEffect(() => { void reload(); }, [reload]);

  const paid = sumCompleted(payments);
  return {
    payments,
    paid,
    outstanding: Math.max(0, total - paid),
    payState: payStateOf(total, paid),
    reload,
  };
}

/** Accounts available for money movement — the cash/bank side of a payment. */
export function usePaymentAccounts() {
  return useQuery({
    queryKey: ["finance-accounts-options"],
    queryFn: async () =>
      (await supabase.from("finance_accounts").select("id,name,account_number,account_type,payment_method").eq("status", "Active").order("name")).data ?? [],
  });
}

export const accountLabel = (account: any) =>
  account.account_number ? `${account.account_number} · ${account.name}` : String(account.name);

/**
 * Records ONE real money movement against a business event.
 * The event itself is never copied into Payments — only the amount actually paid,
 * capped at the remaining outstanding balance so a source can never be overpaid
 * or paid twice for the same balance.
 */
export function SourcePaymentDialog({
  open, onClose, sourceType, sourceId, outstanding, direction, paymentType, description, counterparty, invoiceNumber, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sourceType: PaymentSourceType;
  sourceId: string;
  outstanding: number;
  direction: "in" | "out";
  paymentType: string;
  description: string;
  counterparty?: { customerId?: string; customerName?: string; supplierId?: string; supplierName?: string };
  invoiceNumber?: string;
  onSaved?: () => void | Promise<void>;
}) {
  const { data: accounts = [] } = usePaymentAccounts();
  const [saving, setSaving] = useState(false);

  const submit = (value: Record<string, FieldValue>) => {
    const amount = num(value.amount);
    if (amount <= 0) { toast.error("Enter an amount greater than zero"); return; }
    if (amount > outstanding + 0.005) { toast.error("Amount is more than the outstanding balance"); return; }
    const account = (accounts as any[]).find((row) => accountLabel(row) === str(value.account));
    setSaving(true);
    void supabase
      .from("finance_payments")
      .insert({
        payment_type: paymentType,
        payment_method: str(value.paymentMethod) || account?.payment_method || "Cash",
        account_id: account?.id ?? null,
        direction,
        amount,
        payment_date: str(value.paymentDate),
        reference: withLink(sourceType, sourceId, str(value.reference)),
        customer_id: counterparty?.customerId || null,
        customer_name: counterparty?.customerName || null,
        supplier_id: counterparty?.supplierId || null,
        supplier_name: counterparty?.supplierName || null,
        invoice_number: invoiceNumber || null,
        description,
        notes: str(value.notes) || null,
        status: "Completed",
      } as any)
      .then(async ({ error }) => {
        setSaving(false);
        if (error) { toast.error("Could not record the payment"); return; }
        toast.success("Payment recorded");
        await onSaved?.();
        onClose();
      });
  };

  return (
    <RecordDialog
      open={open}
      icon={CreditCard}
      title="Record payment"
      description={`Outstanding balance: ${new Intl.NumberFormat("en-US").format(Math.round(outstanding))}`}
      submitLabel={saving ? "Saving…" : "Record payment"}
      initialValue={{ paymentDate: new Date().toISOString().slice(0, 10), amount: Math.round(outstanding) }}
      onClose={onClose}
      onSubmit={submit}
      fields={[
        { name: "amount", label: "Amount", type: "number", required: true, half: true },
        { name: "paymentDate", label: "Date", type: "date", required: true, half: true },
        { name: "paymentMethod", label: "Payment method", type: "select", options: PAYMENT_METHODS, half: true },
        { name: "account", label: "Cash / bank account", type: "select", options: (accounts as any[]).map(accountLabel), half: true },
        { name: "reference", label: "Reference", type: "text", half: true },
        { name: "notes", label: "Notes", type: "text" },
      ]}
    />
  );
}
