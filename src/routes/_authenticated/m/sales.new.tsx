import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingCart, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaxWorkspace } from "@/components/tax/tax-workspace";
import { LineItemsEditor, productSpec } from "@/components/sales/line-items-editor";
import { docNumber, formatMoney, lineTotals, useSales, type LineItem } from "@/components/sales/sales-provider";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { buildSalesDocumentPdf } from "@/lib/sales-pdf";

export const Route = createFileRoute("/_authenticated/m/sales/new")({ component: NewSalePage });

const today = () => new Date().toISOString().slice(0, 10);

function NewSalePage() {
  const navigate = useNavigate();
  const business = useBusinessProfile();
  const { products, customers, saveSale, saveQuotation } = useSales();

  const [items, setItems] = useState<LineItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const customer = customers.find((row) => row.id === customerId);
  const customerName = customer?.name ?? "Walk-in customer";
  const totals = lineTotals(items, discount);

  const reset = () => {
    setItems([]);
    setDiscount(0);
    setAmountPaid(0);
    setNotes("");
  };

  const downloadInvoice = (invoiceNumber: string, paid: number) => {
    buildSalesDocumentPdf(
      {
        kind: "INVOICE",
        number: invoiceNumber,
        date: saleDate,
        business,
        customer: { name: customerName, phone: customer?.phone, address: customer?.address },
        lines: items.map((item) => {
          const product = products.find((row) => row.id === item.productId);
          return {
            name: item.productName,
            spec: product ? productSpec(product) : "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          };
        }),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: discount,
        total: totals.total,
        amountPaid: paid,
        notes,
      },
      `${invoiceNumber}.pdf`,
    );
  };

  const complete = async (status: "Completed" | "Draft") => {
    if (items.length === 0) { toast.error("Add at least one product"); return; }
    setBusy(true);
    const invoiceNumber = docNumber(status === "Draft" ? "DRF" : "INV");
    const paid = status === "Completed" ? (amountPaid || totals.total) : 0;
    const id = await saveSale(
      {
        invoiceNumber,
        customerId,
        customerName,
        saleDate,
        dueDate: "",
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: discount,
        total: totals.total,
        amountPaid: paid,
        paymentMethod,
        status,
        notes,
      },
      items,
    );
    setBusy(false);
    if (!id) { toast.error("Could not save the sale"); return; }
    if (status === "Completed") {
      toast.success(`Sale ${invoiceNumber} completed — stock updated`);
      downloadInvoice(invoiceNumber, paid);
      reset();
      void navigate({ to: "/m/sales/invoices" });
    } else {
      toast.success(`Draft ${invoiceNumber} saved — stock untouched`);
      reset();
      void navigate({ to: "/m/sales/drafts" });
    }
  };

  const asQuotation = async () => {
    if (items.length === 0) { toast.error("Add at least one product"); return; }
    setBusy(true);
    const quoteNo = docNumber("QTN");
    await saveQuotation(
      {
        quoteNo,
        customerId,
        customerName,
        quoteDate: saleDate,
        validUntil: "",
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: discount,
        total: totals.total,
        notes,
        status: "Draft",
      },
      items,
    );
    setBusy(false);
    toast.success(`Quotation ${quoteNo} saved — stock untouched`);
    reset();
    void navigate({ to: "/m/sales/quotations" });
  };

  return (
    <TaxWorkspace
      title="New Sale"
      subtitle="Pick products from Inventory, then complete, draft or quote"
      icon={ShoppingCart}
      backTo="/m/sales"
      backLabel="Back to Sales"
    >
      <section className="rounded-3xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Customer</Label>
            <Select value={customerId || "walk-in"} onValueChange={(value) => setCustomerId(value === "walk-in" ? "" : value)}>
              <SelectTrigger className="mt-1 border-white/15 bg-black/25 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in customer</SelectItem>
                {customers.map((row) => (<SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Sale date</Label>
            <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="mt-1 border-white/15 bg-black/25 text-white" />
          </div>
        </div>

        <div className="mt-4">
          <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Items</Label>
          <div className="mt-2">
            <LineItemsEditor products={products} items={items} onChange={setItems} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Payment method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1 border-white/15 bg-black/25 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["cash", "mobile", "card", "bank", "credit"].map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Discount</Label>
            <Input type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} className="mt-1 border-white/15 bg-black/25 text-white" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Amount paid</Label>
            <Input type="number" value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value))} placeholder={String(Math.round(totals.total))} className="mt-1 border-white/15 bg-black/25 text-white" />
          </div>
        </div>

        <div className="mt-3">
          <Label className="text-xs uppercase tracking-[0.14em] text-white/55">Notes</Label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 border-white/15 bg-black/25 text-white" />
        </div>

        <div className="mt-4 rounded-2xl border border-white/15 bg-black/25 p-4 text-sm">
          <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span></div>
          <div className="mt-1 flex justify-between text-white/70"><span>Tax</span><span>{formatMoney(totals.taxAmount)}</span></div>
          <div className="mt-1 flex justify-between text-white/70"><span>Discount</span><span>- {formatMoney(discount)}</span></div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-amber-300">
            <span>Total</span><span>{formatMoney(totals.total)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="bg-amber-400 text-black hover:bg-amber-300" disabled={busy} onClick={() => void complete("Completed")}>
            <FileDown className="mr-1.5 h-4 w-4" /> Complete sale &amp; invoice
          </Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" disabled={busy} onClick={() => void complete("Draft")}>
            Save as draft
          </Button>
          <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/15" disabled={busy} onClick={() => void asQuotation()}>
            Save as quotation
          </Button>
        </div>
        <p className="mt-3 text-xs text-white/45">Completed sales reduce Inventory stock. Drafts and quotations do not touch stock.</p>
      </section>
    </TaxWorkspace>
  );
}
