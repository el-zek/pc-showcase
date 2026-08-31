import { supabase } from "@/integrations/supabase/client";

/**
 * Money-movement linking layer.
 *
 * Business events (sales, purchases, expenses) are NOT money movements.
 * The only cash/bank movements live in `finance_payments`. To link a payment
 * back to the business event that caused it without changing the existing
 * schema, the link is encoded inside the existing `reference` column as
 * `[src:<type>:<id>]`. Everything else about finance_payments stays untouched.
 *
 * Duplicate prevention:
 * - mirrored payments (one-to-one with a source row, e.g. a sales_payment)
 *   are upserted by their link token, so re-saving never inserts twice;
 * - manual payments against a source are plain inserts chosen by the user,
 *   and the UI blocks amounts above the remaining outstanding balance.
 */

export type PaymentSourceType = "sale" | "sales_payment" | "purchase" | "expense";

const TOKEN = /\[src:([a-z_]+):([0-9a-fA-F-]{36})\]/;

export function linkToken(type: PaymentSourceType, id: string) {
  return `[src:${type}:${id}]`;
}

export function withLink(type: PaymentSourceType, id: string, reference?: string) {
  const text = (reference ?? "").replace(TOKEN, "").trim();
  return text ? `${text} ${linkToken(type, id)}` : linkToken(type, id);
}

export function parseLink(reference?: string | null): { type: PaymentSourceType; id: string } | null {
  const match = TOKEN.exec(reference ?? "");
  return match ? { type: match[1] as PaymentSourceType, id: match[2]! } : null;
}

/** Reference text without the internal link token — what the user typed. */
export function cleanReference(reference?: string | null) {
  return (reference ?? "").replace(TOKEN, "").trim();
}

export type LinkedPayment = {
  id: string;
  amount: number;
  paymentDate: string;
  status: string;
  direction: "in" | "out";
  accountId: string;
  paymentMethod: string;
  reference: string;
};

/** All payments linked to one business event. */
export async function fetchLinkedPayments(type: PaymentSourceType, id: string): Promise<LinkedPayment[]> {
  if (!id) return [];
  const { data } = await supabase
    .from("finance_payments")
    .select("id,amount,payment_date,status,direction,account_id,payment_method,reference")
    .like("reference", `%${linkToken(type, id)}%`)
    .order("payment_date", { ascending: false });
  return (data ?? []).map((row: any) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    paymentDate: String(row.payment_date ?? ""),
    status: String(row.status ?? ""),
    direction: row.direction === "in" ? "in" : "out",
    accountId: String(row.account_id ?? ""),
    paymentMethod: String(row.payment_method ?? ""),
    reference: cleanReference(row.reference),
  }));
}

export const sumCompleted = (rows: LinkedPayment[]) =>
  rows.filter((row) => row.status === "Completed").reduce((total, row) => total + row.amount, 0);

/**
 * Insert or update the single payment mirroring a one-to-one source row.
 * Safe to call repeatedly — it never creates a second record for the same source.
 */
export async function upsertMirrorPayment(
  type: PaymentSourceType,
  id: string,
  payload: {
    paymentType: string;
    direction: "in" | "out";
    amount: number;
    paymentDate: string;
    accountId?: string;
    paymentMethod: string;
    description?: string;
    customerId?: string;
    customerName?: string;
    supplierId?: string;
    supplierName?: string;
    invoiceNumber?: string;
    reference?: string;
    status?: string;
  },
) {
  if (!id) return;
  const existing = await fetchLinkedPayments(type, id);
  const row = {
    payment_type: payload.paymentType,
    payment_method: payload.paymentMethod || "cash",
    account_id: payload.accountId || null,
    direction: payload.direction,
    amount: payload.amount,
    payment_date: payload.paymentDate,
    reference: withLink(type, id, payload.reference),
    customer_id: payload.customerId || null,
    customer_name: payload.customerName || null,
    supplier_id: payload.supplierId || null,
    supplier_name: payload.supplierName || null,
    invoice_number: payload.invoiceNumber || null,
    description: payload.description || null,
    status: payload.status || "Completed",
  };
  if (existing[0]) await supabase.from("finance_payments").update(row as any).eq("id", existing[0].id);
  else await supabase.from("finance_payments").insert(row as any);
}

/** Remove every money movement linked to a source (used when the source row is deleted). */
export async function deleteLinkedPayments(type: PaymentSourceType, id: string) {
  if (!id) return;
  const existing = await fetchLinkedPayments(type, id);
  for (const row of existing) await supabase.from("finance_payments").delete().eq("id", row.id);
}

/** Resolve a payment account from a free-text method/account label used by older forms. */
export async function resolveAccount(label: string) {
  const clean = (label ?? "").trim();
  if (!clean) return null;
  const { data } = await supabase.from("finance_accounts").select("id,name,account_number,payment_method");
  const rows = (data ?? []) as any[];
  const lower = clean.toLowerCase();
  return (
    rows.find((row) => `${row.account_number ?? ""} · ${row.name}`.toLowerCase() === lower) ??
    rows.find((row) => String(row.name).toLowerCase() === lower) ??
    rows.find((row) => String(row.payment_method ?? "").toLowerCase() === lower) ??
    null
  );
}

/** Every linked payment for one source type, grouped by source id (for list views). */
export async function fetchLinkedPaymentMap(type: PaymentSourceType): Promise<Record<string, LinkedPayment[]>> {
  const { data } = await supabase
    .from("finance_payments")
    .select("id,amount,payment_date,status,direction,account_id,payment_method,reference")
    .like("reference", `%[src:${type}:%`);
  const map: Record<string, LinkedPayment[]> = {};
  for (const row of (data ?? []) as any[]) {
    const link = parseLink(row.reference);
    if (!link || link.type !== type) continue;
    (map[link.id] ??= []).push({
      id: row.id,
      amount: Number(row.amount ?? 0),
      paymentDate: String(row.payment_date ?? ""),
      status: String(row.status ?? ""),
      direction: row.direction === "in" ? "in" : "out",
      accountId: String(row.account_id ?? ""),
      paymentMethod: String(row.payment_method ?? ""),
      reference: cleanReference(row.reference),
    });
  }
  return map;
}
