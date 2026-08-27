import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ---------------------------------- types --------------------------------- */

export type SalesProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  sellingPrice: number;
  taxRate: number;
  stockQuantity: number;
};

export type SalesCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

export type LineItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  lineTotal: number;
};

export type SaleStatus = "Completed" | "Draft" | "Cancelled";

export type SaleRecord = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  saleDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  status: SaleStatus;
  notes: string;
};

export type SaleItemRecord = LineItem & { id: string; saleId: string };

export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";

export type QuotationRecord = {
  id: string;
  quoteNo: string;
  customerId: string;
  customerName: string;
  quoteDate: string;
  validUntil: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes: string;
  status: QuotationStatus;
};

export type QuotationItemRecord = LineItem & { id: string; quotationId: string };

export type OrderStatus = "Pending" | "Confirmed" | "Fulfilled" | "Cancelled";

export type OrderRecord = {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes: string;
  status: OrderStatus;
};

export type OrderItemRecord = LineItem & { id: string; orderId: string };

export type ReturnStatus = "Pending" | "Approved" | "Rejected";

export type ReturnRecord = {
  id: string;
  returnNo: string;
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  returnDate: string;
  reason: string;
  total: number;
  status: ReturnStatus;
};

export type ReturnItemRecord = { id: string; returnId: string; productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number };

export type PaymentRecord = {
  id: string;
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  paymentDate: string;
  amount: number;
  method: string;
  reference: string;
  notes: string;
  status: "Received" | "Pending";
};

/* -------------------------------- helpers -------------------------------- */

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));
const today = () => new Date().toISOString().slice(0, 10);

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function buildLine(product: SalesProduct, quantity: number, unitPrice?: number): LineItem {
  const price = unitPrice ?? product.sellingPrice;
  const lineTotal = price * quantity;
  return {
    productId: product.id,
    productName: product.name,
    quantity,
    unitPrice: price,
    taxAmount: lineTotal * (product.taxRate / 100),
    lineTotal,
  };
}

export function lineTotals(items: LineItem[], discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
  return { subtotal, taxAmount, total: Math.max(0, subtotal + taxAmount - discount) };
}

export const docNumber = (prefix: string) => `${prefix}-${Date.now().toString().slice(-8)}`;

/* -------------------------------- mappers -------------------------------- */

const mapProduct = (r: any): SalesProduct => ({
  id: r.id, name: str(r.name), sku: str(r.sku), category: str(r.category), description: str(r.description),
  sellingPrice: num(r.selling_price), taxRate: num(r.tax_rate), stockQuantity: num(r.stock_quantity),
});

const mapCustomer = (r: any): SalesCustomer => ({
  id: r.id, name: str(r.name), phone: str(r.phone), address: str(r.address ?? r.location),
});

const mapSale = (r: any): SaleRecord => ({
  id: r.id, invoiceNumber: str(r.invoice_number), customerId: str(r.customer_id), customerName: str(r.customer_name) || "Walk-in customer",
  saleDate: str(r.sale_date) || str(r.created_at).slice(0, 10), dueDate: str(r.due_date),
  subtotal: num(r.subtotal), taxAmount: num(r.tax_amount), discountAmount: num(r.discount_amount),
  total: num(r.total), amountPaid: num(r.amount_paid), paymentMethod: str(r.payment_method) || "cash",
  status: (str(r.status).toLowerCase() === "draft" ? "Draft" : str(r.status).toLowerCase() === "cancelled" ? "Cancelled" : "Completed"),
  notes: str(r.notes),
});

const mapSaleItem = (r: any): SaleItemRecord => ({
  id: r.id, saleId: str(r.sale_id), productId: str(r.product_id), productName: str(r.product_name),
  quantity: num(r.quantity), unitPrice: num(r.unit_price), taxAmount: num(r.tax_amount), lineTotal: num(r.line_total),
});

const mapQuotation = (r: any): QuotationRecord => ({
  id: r.id, quoteNo: str(r.quote_no), customerId: str(r.customer_id), customerName: str(r.customer_name),
  quoteDate: str(r.quote_date), validUntil: str(r.valid_until),
  subtotal: num(r.subtotal), taxAmount: num(r.tax_amount), discountAmount: num(r.discount_amount),
  total: num(r.total), notes: str(r.notes), status: (r.status ?? "Draft") as QuotationStatus,
});

const mapQuotationItem = (r: any): QuotationItemRecord => ({
  id: r.id, quotationId: str(r.quotation_id), productId: str(r.product_id), productName: str(r.product_name),
  quantity: num(r.quantity), unitPrice: num(r.unit_price), taxAmount: num(r.tax_amount), lineTotal: num(r.line_total),
});

const mapOrder = (r: any): OrderRecord => ({
  id: r.id, orderNo: str(r.order_no), customerId: str(r.customer_id), customerName: str(r.customer_name),
  orderDate: str(r.order_date), deliveryDate: str(r.delivery_date),
  subtotal: num(r.subtotal), taxAmount: num(r.tax_amount), discountAmount: num(r.discount_amount),
  total: num(r.total), notes: str(r.notes), status: (r.status ?? "Pending") as OrderStatus,
});

const mapOrderItem = (r: any): OrderItemRecord => ({
  id: r.id, orderId: str(r.order_id), productId: str(r.product_id), productName: str(r.product_name),
  quantity: num(r.quantity), unitPrice: num(r.unit_price), taxAmount: num(r.tax_amount), lineTotal: num(r.line_total),
});

const mapReturn = (r: any): ReturnRecord => ({
  id: r.id, returnNo: str(r.return_no), saleId: str(r.sale_id), invoiceNumber: str(r.invoice_number),
  customerName: str(r.customer_name), returnDate: str(r.return_date), reason: str(r.reason),
  total: num(r.total), status: (r.status ?? "Pending") as ReturnStatus,
});

const mapReturnItem = (r: any): ReturnItemRecord => ({
  id: r.id, returnId: str(r.return_id), productId: str(r.product_id), productName: str(r.product_name),
  quantity: num(r.quantity), unitPrice: num(r.unit_price), lineTotal: num(r.line_total),
});

const mapPayment = (r: any): PaymentRecord => ({
  id: r.id, saleId: str(r.sale_id), invoiceNumber: str(r.invoice_number), customerName: str(r.customer_name),
  paymentDate: str(r.payment_date), amount: num(r.amount), method: str(r.method) || "cash",
  reference: str(r.reference), notes: str(r.notes), status: (r.status ?? "Received") as PaymentRecord["status"],
});

/* --------------------------------- context -------------------------------- */

type SalesMetrics = {
  salesTotal: number;
  salesCount: number;
  outstanding: number;
  paidTotal: number;
  taxTotal: number;
  draftCount: number;
  quotationTotal: number;
  quotationCount: number;
  orderTotal: number;
  orderCount: number;
  returnTotal: number;
  returnCount: number;
  paymentsTotal: number;
};

type ContextValue = {
  loading: boolean;
  products: SalesProduct[];
  customers: SalesCustomer[];
  sales: SaleRecord[];
  saleItems: SaleItemRecord[];
  quotations: QuotationRecord[];
  quotationItems: QuotationItemRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  returns: ReturnRecord[];
  returnItems: ReturnItemRecord[];
  payments: PaymentRecord[];
  metrics: SalesMetrics;
  refresh: () => Promise<void>;
  saveSale: (record: Omit<SaleRecord, "id">, items: LineItem[], id?: string) => Promise<string | null>;
  deleteSale: (id: string) => Promise<void>;
  completeDraft: (id: string) => Promise<void>;
  saveQuotation: (record: Omit<QuotationRecord, "id">, items: LineItem[], id?: string) => Promise<string | null>;
  deleteQuotation: (id: string) => Promise<void>;
  setQuotationStatus: (id: string, status: QuotationStatus) => Promise<void>;
  convertQuotation: (id: string) => Promise<void>;
  saveOrder: (record: Omit<OrderRecord, "id">, items: LineItem[], id?: string) => Promise<string | null>;
  deleteOrder: (id: string) => Promise<void>;
  setOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  fulfillOrder: (id: string) => Promise<void>;
  saveReturn: (record: Omit<ReturnRecord, "id">, items: Omit<ReturnItemRecord, "id" | "returnId">[], id?: string) => Promise<void>;
  deleteReturn: (id: string) => Promise<void>;
  approveReturn: (id: string) => Promise<void>;
  savePayment: (record: Omit<PaymentRecord, "id">, id?: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
};

const SalesContext = createContext<ContextValue | null>(null);

/* -------------------------------- provider -------------------------------- */

export function SalesProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [quotationItems, setQuotationItems] = useState<QuotationItemRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRecord[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItemRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const refresh = useCallback(async () => {
    const [p, c, s, si, q, qi, o, oi, r, ri, pay] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("customers").select("*").order("name"),
      supabase.from("sales").select("*").order("created_at", { ascending: false }),
      supabase.from("sale_items").select("*"),
      supabase.from("quotations").select("*").order("quote_date", { ascending: false }),
      supabase.from("quotation_items").select("*"),
      supabase.from("sales_orders").select("*").order("order_date", { ascending: false }),
      supabase.from("sales_order_items").select("*"),
      supabase.from("sales_returns").select("*").order("return_date", { ascending: false }),
      supabase.from("sales_return_items").select("*"),
      supabase.from("sales_payments").select("*").order("payment_date", { ascending: false }),
    ]);
    setProducts((p.data ?? []).map(mapProduct));
    setCustomers((c.data ?? []).map(mapCustomer));
    setSales((s.data ?? []).map(mapSale));
    setSaleItems((si.data ?? []).map(mapSaleItem));
    setQuotations((q.data ?? []).map(mapQuotation));
    setQuotationItems((qi.data ?? []).map(mapQuotationItem));
    setOrders((o.data ?? []).map(mapOrder));
    setOrderItems((oi.data ?? []).map(mapOrderItem));
    setReturns((r.data ?? []).map(mapReturn));
    setReturnItems((ri.data ?? []).map(mapReturnItem));
    setPayments((pay.data ?? []).map(mapPayment));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ----------------------------- stock effects ---------------------------- */

  const moveStock = useCallback(
    async (items: { productId: string; productName: string; quantity: number }[], direction: "out" | "in", reference: string) => {
      for (const item of items) {
        if (!item.productId) continue;
        const { data } = await supabase.from("products").select("stock_quantity").eq("id", item.productId).maybeSingle();
        const current = num((data as any)?.stock_quantity);
        const next = direction === "out" ? Math.max(0, current - item.quantity) : current + item.quantity;
        await supabase.from("products").update({ stock_quantity: next } as any).eq("id", item.productId);
        await supabase.from("stock_movements").insert({
          product_id: item.productId,
          product_name: item.productName,
          type: direction === "out" ? "Stock Out" : "Stock In",
          quantity: direction === "out" ? -item.quantity : item.quantity,
          reference,
          movement_date: today(),
        } as any);
      }
    },
    [],
  );

  /* -------------------------------- sales -------------------------------- */

  const saleRow = (record: Omit<SaleRecord, "id">) => ({
    invoice_number: record.invoiceNumber,
    customer_id: record.customerId || null,
    customer_name: record.customerName || null,
    sale_date: record.saleDate || today(),
    due_date: record.dueDate || null,
    subtotal: record.subtotal,
    tax_amount: record.taxAmount,
    discount_amount: record.discountAmount,
    total: record.total,
    amount_paid: record.amountPaid,
    payment_method: record.paymentMethod,
    status: record.status.toLowerCase(),
    notes: record.notes || null,
  });

  const writeItems = useCallback(
    async (table: "sale_items" | "quotation_items" | "sales_order_items", key: string, parentId: string, items: LineItem[]) => {
      await supabase.from(table).delete().eq(key, parentId);
      if (items.length === 0) return;
      await supabase.from(table).insert(
        items.map((item) => ({
          [key]: parentId,
          product_id: item.productId || null,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_amount: item.taxAmount,
          line_total: item.lineTotal,
        })) as any,
      );
    },
    [],
  );

  const saveSale = useCallback(
    async (record: Omit<SaleRecord, "id">, items: LineItem[], id?: string) => {
      let saleId = id ?? null;
      const previous = id ? sales.find((row) => row.id === id) : undefined;
      if (id) {
        await supabase.from("sales").update(saleRow(record) as any).eq("id", id);
      } else {
        const { data } = await supabase.from("sales").insert(saleRow(record) as any).select("id").single();
        saleId = (data as any)?.id ?? null;
      }
      if (!saleId) return null;
      await writeItems("sale_items", "sale_id", saleId, items);

      const wasCompleted = previous?.status === "Completed";
      if (record.status === "Completed" && !wasCompleted) {
        await moveStock(items, "out", record.invoiceNumber);
      }
      await refresh();
      return saleId;
    },
    [sales, writeItems, moveStock, refresh],
  );

  const completeDraft = useCallback(
    async (id: string) => {
      const sale = sales.find((row) => row.id === id);
      if (!sale || sale.status === "Completed") return;
      const items = saleItems.filter((item) => item.saleId === id);
      await supabase.from("sales").update({ status: "completed", amount_paid: sale.total } as any).eq("id", id);
      await moveStock(items, "out", sale.invoiceNumber);
      await refresh();
    },
    [sales, saleItems, moveStock, refresh],
  );

  const deleteSale = useCallback(
    async (id: string) => {
      await supabase.from("sales").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  /* ------------------------------ quotations ------------------------------ */

  const quotationRow = (record: Omit<QuotationRecord, "id">) => ({
    quote_no: record.quoteNo,
    customer_id: record.customerId || null,
    customer_name: record.customerName,
    quote_date: record.quoteDate || today(),
    valid_until: record.validUntil || null,
    subtotal: record.subtotal,
    tax_amount: record.taxAmount,
    discount_amount: record.discountAmount,
    total: record.total,
    notes: record.notes || null,
    status: record.status,
  });

  const saveQuotation = useCallback(
    async (record: Omit<QuotationRecord, "id">, items: LineItem[], id?: string) => {
      let quoteId = id ?? null;
      if (id) {
        await supabase.from("quotations").update(quotationRow(record) as any).eq("id", id);
      } else {
        const { data } = await supabase.from("quotations").insert(quotationRow(record) as any).select("id").single();
        quoteId = (data as any)?.id ?? null;
      }
      if (!quoteId) return null;
      await writeItems("quotation_items", "quotation_id", quoteId, items);
      await refresh();
      return quoteId;
    },
    [writeItems, refresh],
  );

  const deleteQuotation = useCallback(
    async (id: string) => {
      await supabase.from("quotations").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const setQuotationStatus = useCallback(
    async (id: string, status: QuotationStatus) => {
      await supabase.from("quotations").update({ status } as any).eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const convertQuotation = useCallback(
    async (id: string) => {
      const quote = quotations.find((row) => row.id === id);
      if (!quote) return;
      const items: LineItem[] = quotationItems
        .filter((item) => item.quotationId === id)
        .map(({ productId, productName, quantity, unitPrice, taxAmount, lineTotal }) => ({ productId, productName, quantity, unitPrice, taxAmount, lineTotal }));
      const invoiceNumber = docNumber("INV");
      await saveSale(
        {
          invoiceNumber,
          customerId: quote.customerId,
          customerName: quote.customerName,
          saleDate: today(),
          dueDate: "",
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          total: quote.total,
          amountPaid: 0,
          paymentMethod: "credit",
          status: "Completed",
          notes: `Converted from quotation ${quote.quoteNo}`,
        },
        items,
      );
      await supabase.from("quotations").update({ status: "Accepted" } as any).eq("id", id);
      await refresh();
    },
    [quotations, quotationItems, saveSale, refresh],
  );

  /* -------------------------------- orders -------------------------------- */

  const orderRow = (record: Omit<OrderRecord, "id">) => ({
    order_no: record.orderNo,
    customer_id: record.customerId || null,
    customer_name: record.customerName,
    order_date: record.orderDate || today(),
    delivery_date: record.deliveryDate || null,
    subtotal: record.subtotal,
    tax_amount: record.taxAmount,
    discount_amount: record.discountAmount,
    total: record.total,
    notes: record.notes || null,
    status: record.status,
  });

  const saveOrder = useCallback(
    async (record: Omit<OrderRecord, "id">, items: LineItem[], id?: string) => {
      let orderId = id ?? null;
      if (id) {
        await supabase.from("sales_orders").update(orderRow(record) as any).eq("id", id);
      } else {
        const { data } = await supabase.from("sales_orders").insert(orderRow(record) as any).select("id").single();
        orderId = (data as any)?.id ?? null;
      }
      if (!orderId) return null;
      await writeItems("sales_order_items", "order_id", orderId, items);
      await refresh();
      return orderId;
    },
    [writeItems, refresh],
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      await supabase.from("sales_orders").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const setOrderStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      await supabase.from("sales_orders").update({ status } as any).eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const fulfillOrder = useCallback(
    async (id: string) => {
      const order = orders.find((row) => row.id === id);
      if (!order || order.status === "Fulfilled") return;
      const items: LineItem[] = orderItems
        .filter((item) => item.orderId === id)
        .map(({ productId, productName, quantity, unitPrice, taxAmount, lineTotal }) => ({ productId, productName, quantity, unitPrice, taxAmount, lineTotal }));
      await saveSale(
        {
          invoiceNumber: docNumber("INV"),
          customerId: order.customerId,
          customerName: order.customerName,
          saleDate: today(),
          dueDate: "",
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          discountAmount: order.discountAmount,
          total: order.total,
          amountPaid: 0,
          paymentMethod: "credit",
          status: "Completed",
          notes: `Fulfilled from order ${order.orderNo}`,
        },
        items,
      );
      await supabase.from("sales_orders").update({ status: "Fulfilled" } as any).eq("id", id);
      await refresh();
    },
    [orders, orderItems, saveSale, refresh],
  );

  /* -------------------------------- returns ------------------------------- */

  const saveReturn = useCallback(
    async (record: Omit<ReturnRecord, "id">, items: Omit<ReturnItemRecord, "id" | "returnId">[], id?: string) => {
      const row = {
        return_no: record.returnNo,
        sale_id: record.saleId || null,
        invoice_number: record.invoiceNumber || null,
        customer_name: record.customerName,
        return_date: record.returnDate || today(),
        reason: record.reason || null,
        total: record.total,
        status: record.status,
      };
      let returnId = id ?? null;
      if (id) {
        await supabase.from("sales_returns").update(row as any).eq("id", id);
        await supabase.from("sales_return_items").delete().eq("return_id", id);
      } else {
        const { data } = await supabase.from("sales_returns").insert(row as any).select("id").single();
        returnId = (data as any)?.id ?? null;
      }
      if (returnId && items.length > 0) {
        await supabase.from("sales_return_items").insert(
          items.map((item) => ({
            return_id: returnId,
            product_id: item.productId || null,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.lineTotal,
          })) as any,
        );
      }
      await refresh();
    },
    [refresh],
  );

  const deleteReturn = useCallback(
    async (id: string) => {
      await supabase.from("sales_returns").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const approveReturn = useCallback(
    async (id: string) => {
      const record = returns.find((row) => row.id === id);
      if (!record || record.status === "Approved") return;
      const items = returnItems.filter((item) => item.returnId === id);
      await supabase.from("sales_returns").update({ status: "Approved" } as any).eq("id", id);
      await moveStock(items, "in", record.returnNo);
      await refresh();
    },
    [returns, returnItems, moveStock, refresh],
  );

  /* ------------------------------- payments ------------------------------- */

  const savePayment = useCallback(
    async (record: Omit<PaymentRecord, "id">, id?: string) => {
      const row = {
        sale_id: record.saleId || null,
        invoice_number: record.invoiceNumber || null,
        customer_name: record.customerName,
        payment_date: record.paymentDate || today(),
        amount: record.amount,
        method: record.method,
        reference: record.reference || null,
        notes: record.notes || null,
        status: record.status,
      };
      if (id) await supabase.from("sales_payments").update(row as any).eq("id", id);
      else await supabase.from("sales_payments").insert(row as any);

      if (record.saleId && record.status === "Received") {
        const sale = sales.find((row2) => row2.id === record.saleId);
        if (sale) {
          const others = payments
            .filter((p) => p.saleId === record.saleId && p.status === "Received" && p.id !== id)
            .reduce((sum, p) => sum + p.amount, 0);
          const paid = Math.min(sale.total, others + record.amount);
          await supabase.from("sales").update({ amount_paid: paid } as any).eq("id", sale.id);
        }
      }
      await refresh();
    },
    [sales, payments, refresh],
  );

  const deletePayment = useCallback(
    async (id: string) => {
      await supabase.from("sales_payments").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  /* -------------------------------- metrics ------------------------------- */

  const metrics = useMemo<SalesMetrics>(() => {
    const completed = sales.filter((row) => row.status === "Completed");
    const salesTotal = completed.reduce((sum, row) => sum + row.total, 0);
    const paidTotal = completed.reduce((sum, row) => sum + row.amountPaid, 0);
    return {
      salesTotal,
      salesCount: completed.length,
      outstanding: Math.max(0, salesTotal - paidTotal),
      paidTotal,
      taxTotal: completed.reduce((sum, row) => sum + row.taxAmount, 0),
      draftCount: sales.filter((row) => row.status === "Draft").length,
      quotationTotal: quotations.reduce((sum, row) => sum + row.total, 0),
      quotationCount: quotations.length,
      orderTotal: orders.reduce((sum, row) => sum + row.total, 0),
      orderCount: orders.length,
      returnTotal: returns.reduce((sum, row) => sum + row.total, 0),
      returnCount: returns.length,
      paymentsTotal: payments.filter((row) => row.status === "Received").reduce((sum, row) => sum + row.amount, 0),
    };
  }, [sales, quotations, orders, returns, payments]);

  const value: ContextValue = {
    loading,
    products,
    customers,
    sales,
    saleItems,
    quotations,
    quotationItems,
    orders,
    orderItems,
    returns,
    returnItems,
    payments,
    metrics,
    refresh,
    saveSale,
    deleteSale,
    completeDraft,
    saveQuotation,
    deleteQuotation,
    setQuotationStatus,
    convertQuotation,
    saveOrder,
    deleteOrder,
    setOrderStatus,
    fulfillOrder,
    saveReturn,
    deleteReturn,
    approveReturn,
    savePayment,
    deletePayment,
  };

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const context = useContext(SalesContext);
  if (!context) throw new Error("useSales must be used inside SalesProvider");
  return context;
}
