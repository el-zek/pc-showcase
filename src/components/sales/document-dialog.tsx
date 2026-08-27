import { useEffect, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModernDialog, panelControlCls, panelLabelCls, panelSectionCls } from "@/components/ui/modern-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LineItemsEditor } from "@/components/sales/line-items-editor";
import { formatMoney, lineTotals, type LineItem, type SalesCustomer, type SalesProduct } from "@/components/sales/sales-provider";


export type DocumentDraft = {
  customerId: string;
  customerName: string;
  date: string;
  secondDate: string;
  discountAmount: number;
  notes: string;
  status: string;
  items: LineItem[];
};

const today = () => new Date().toISOString().slice(0, 10);

export const emptyDraft = (status: string): DocumentDraft => ({
  customerId: "",
  customerName: "",
  date: today(),
  secondDate: "",
  discountAmount: 0,
  notes: "",
  status,
  items: [],
});

export function DocumentDialog({
  open,
  title,
  description,
  submitLabel,
  dateLabel,
  secondDateLabel,
  statusOptions,
  products,
  customers,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  dateLabel: string;
  secondDateLabel: string;
  statusOptions: string[];
  products: SalesProduct[];
  customers: SalesCustomer[];
  initial: DocumentDraft;
  onClose: () => void;
  onSubmit: (draft: DocumentDraft) => void;
}) {
  const [draft, setDraft] = useState<DocumentDraft>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totals = lineTotals(draft.items, draft.discountAmount);
  const patch = (value: Partial<DocumentDraft>) => setDraft((prev) => ({ ...prev, ...value }));

  return (
    <ModernDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={ClipboardList}
      size="2xl"
      footer={
        <>
          <Button
            variant="outline"
            className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/15"
            onClick={onClose}
          >
            Cancel <X className="ml-1.5 h-4 w-4" />
          </Button>
          <Button
            className="h-11 rounded-xl bg-amber-400 font-semibold text-black hover:bg-amber-300"
            disabled={draft.items.length === 0}
            onClick={() => onSubmit(draft)}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className={panelLabelCls}>Customer</Label>
            <Select
              value={draft.customerId || "walk-in"}
              onValueChange={(value) => {
                if (value === "walk-in") patch({ customerId: "", customerName: "Walk-in customer" });
                else {
                  const customer = customers.find((row) => row.id === value);
                  patch({ customerId: value, customerName: customer?.name ?? "" });
                }
              }}
            >
              <SelectTrigger className={panelControlCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={panelLabelCls}>Status</Label>
            <Select value={draft.status} onValueChange={(value) => patch({ status: value })}>
              <SelectTrigger className={panelControlCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={panelLabelCls}>{dateLabel}</Label>
            <Input type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} className={panelControlCls} />
          </div>
          <div>
            <Label className={panelLabelCls}>{secondDateLabel}</Label>
            <Input type="date" value={draft.secondDate} onChange={(event) => patch({ secondDate: event.target.value })} className={panelControlCls} />
          </div>
        </div>

        <div className={panelSectionCls}>
          <Label className={panelLabelCls}>Items from Inventory</Label>
          <div className="mt-2">
            <LineItemsEditor products={products} items={draft.items} onChange={(items) => patch({ items })} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className={panelLabelCls}>Discount</Label>
            <Input type="number" value={draft.discountAmount} onChange={(event) => patch({ discountAmount: Number(event.target.value) })} className={panelControlCls} />
          </div>
          <div>
            <Label className={panelLabelCls}>Notes</Label>
            <Textarea
              value={draft.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              className="mt-1.5 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:border-amber-300/50 focus-visible:ring-0"
              rows={2}
              placeholder="Add notes..."
            />
          </div>
        </div>

        <div className={panelSectionCls}>
          <p className={panelLabelCls}>Summary</p>
          <div className="mt-3 text-sm">
            <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span></div>
            <div className="mt-1 flex justify-between text-white/70"><span>Tax</span><span>{formatMoney(totals.taxAmount)}</span></div>
            <div className="mt-1 flex justify-between text-white/70"><span>Discount</span><span>- {formatMoney(draft.discountAmount)}</span></div>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-amber-300">
              <span>Total</span><span>{formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </ModernDialog>
  );
}
