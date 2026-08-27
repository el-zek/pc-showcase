import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Receipt, ShoppingBag, Wallet, Coins, FileText, AlertTriangle, Clock, Landmark, Layers,
} from "lucide-react";
import { useTaxModule, formatCurrency } from "@/components/tax-module-provider";
import { AnalyticsWorkspace, buildBuckets, pctChange } from "@/components/analytics/analytics-workspace";

export const Route = createFileRoute("/_authenticated/m/tax/reports")({
  validateSearch: (search: Record<string, unknown>) => ({ days: Number(search.days) || 30 }),
  component: TaxReportsHub,
});

function TaxReportsHub() {
  const { days } = Route.useSearch();
  const { metrics, sales, purchases, expenses, vatReturns, documents, obligations } = useTaxModule();

  const stats = useMemo(() => {
    const now = Date.now();
    const from = now - days * 86400_000;
    const priorFrom = now - days * 2 * 86400_000;
    const inRange = (d: string) => new Date(d).getTime() >= from;
    const inPrior = (d: string) => {
      const t = new Date(d).getTime();
      return t >= priorFrom && t < from;
    };

    const s = sales.filter((r) => inRange(r.date));
    const sPrior = sales.filter((r) => inPrior(r.date));
    const p = purchases.filter((r) => inRange(r.date));
    const pPrior = purchases.filter((r) => inPrior(r.date));
    const e = expenses.filter((r) => inRange(r.date));
    const ePrior = expenses.filter((r) => inPrior(r.date));

    const salesTotal = s.reduce((a, r) => a + r.amount, 0);
    const priorSalesTotal = sPrior.reduce((a, r) => a + r.amount, 0);
    const outputVat = s.reduce((a, r) => a + r.vat, 0);
    const priorOutputVat = sPrior.reduce((a, r) => a + r.vat, 0);
    const purchaseTotal = p.reduce((a, r) => a + r.amount, 0);
    const priorPurchaseTotal = pPrior.reduce((a, r) => a + r.amount, 0);
    const expenseTotal = e.reduce((a, r) => a + r.amount, 0);
    const priorExpenseTotal = ePrior.reduce((a, r) => a + r.amount, 0);
    const deductible = e.filter((r) => r.deductible).reduce((a, r) => a + r.amount, 0);

    return {
      s, p, e, salesTotal, priorSalesTotal, outputVat, priorOutputVat,
      purchaseTotal, priorPurchaseTotal, expenseTotal, priorExpenseTotal, deductible,
      count: s.length, priorCount: sPrior.length,
    };
  }, [sales, purchases, expenses, days]);

  const trend = useMemo(() => {
    const keys = ["sales", "vat", "purchases"];
    const salesPoints = buildBuckets(sales, days, (r) => r.date, (p, r) => { p.sales += r.amount; }, keys);
    const vatPoints = buildBuckets(sales, days, (r) => r.date, (p, r) => { p.vat += r.vat; }, keys);
    const purchasePoints = buildBuckets(purchases, days, (r) => r.date, (p, r) => { p.purchases += r.amount; }, keys);
    return salesPoints.map((point, i) => ({
      label: point.label,
      sales: Number(point.sales),
      vat: Number(vatPoints[i]?.vat ?? 0),
      purchases: Number(purchasePoints[i]?.purchases ?? 0),
    }));
  }, [sales, purchases, days]);

  const cards = [
    { label: "Sales (period)", value: formatCurrency(stats.salesTotal), icon: Receipt, delta: pctChange(stats.salesTotal, stats.priorSalesTotal) },
    { label: "Output VAT", value: formatCurrency(stats.outputVat), icon: Landmark, delta: pctChange(stats.outputVat, stats.priorOutputVat) },
    { label: "Purchases", value: formatCurrency(stats.purchaseTotal), icon: ShoppingBag, delta: pctChange(stats.purchaseTotal, stats.priorPurchaseTotal) },
    { label: "Expenses", value: formatCurrency(stats.expenseTotal), icon: Wallet, delta: pctChange(stats.expenseTotal, stats.priorExpenseTotal) },
    { label: "Deductible", value: formatCurrency(stats.deductible), icon: Coins, delta: null },
    { label: "VAT Payable", value: formatCurrency(metrics.vatPayable), icon: Layers, delta: null },
    { label: "Overdue", value: String(metrics.overdue), icon: AlertTriangle, delta: null },
    { label: "Due Soon", value: String(metrics.dueSoon), icon: Clock, delta: null },
  ];

  const summary = [
    { label: "EFD sales records", value: String(stats.count), icon: Receipt, delta: pctChange(stats.count, stats.priorCount) },
    { label: "VAT returns filed", value: String(vatReturns.length), icon: Landmark, delta: null },
    { label: "Documents archived", value: String(documents.length), icon: FileText, delta: null },
  ];

  const pending = obligations.filter((row) => row.status !== "Paid");

  return (
    <AnalyticsWorkspace
      title="Tax Reports"
      backTo="/m/tax"
      days={days}
      metrics={cards}
      summary={summary}
      series={[
        { key: "sales", label: "Sales (TZS)", color: "#fbbf24", axis: "right" },
        { key: "vat", label: "Output VAT", color: "#34d399" },
        { key: "purchases", label: "Purchases (TZS)", color: "#38bdf8", axis: "right" },
      ]}
      trend={trend}
      report={{
        filename: `tax-report-${days}d`,
        title: "Tax Report",
        subtitle: `Last ${days} days · generated ${new Date().toLocaleString("en-GB")}`,
        summary: cards.map((c) => [c.label, c.value] as [string, string]),
        headers: ["Obligation", "Period", "Due date", "Status"],
        rows: pending.map((row) => [row.taxType, row.period, row.dueDate, row.status]),
      }}
    >
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="font-display text-base font-bold text-white">Pending Obligations</h3>
        <div className="mt-3 divide-y divide-white/8">
          {pending.slice(0, 12).map((row) => (
            <div key={`${row.taxType}-${row.period}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate text-white/80">{row.taxType} · {row.period}</span>
              <span className="shrink-0 text-xs text-white/45">{row.dueDate}</span>
              <span className={`shrink-0 text-xs font-medium ${row.status === "Overdue" ? "text-rose-400" : "text-amber-400"}`}>{row.status}</span>
            </div>
          ))}
          {!pending.length ? <p className="py-3 text-xs text-white/40">All obligations are settled.</p> : null}
        </div>
      </div>
    </AnalyticsWorkspace>
  );
}
