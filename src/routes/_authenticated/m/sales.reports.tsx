import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Receipt, Wallet, Coins, TrendingUp, ShoppingBag, RotateCcw, ClipboardList, Users,
} from "lucide-react";
import { AnalyticsWorkspace, buildBuckets, pctChange } from "@/components/analytics/analytics-workspace";
import { formatMoney, useSales } from "@/components/sales/sales-provider";

export const Route = createFileRoute("/_authenticated/m/sales/reports")({
  validateSearch: (search: Record<string, unknown>) => ({ days: Number(search.days) || 30 }),
  component: SalesReportsPage,
});

function SalesReportsPage() {
  const { days } = Route.useSearch();
  const { sales, saleItems, payments, returns } = useSales();

  const stats = useMemo(() => {
    const now = Date.now();
    const from = now - days * 86400_000;
    const priorFrom = now - days * 2 * 86400_000;
    const inRange = (date: string) => new Date(date).getTime() >= from;
    const inPrior = (date: string) => {
      const t = new Date(date).getTime();
      return t >= priorFrom && t < from;
    };

    const completed = sales.filter((row) => row.status === "Completed");
    const current = completed.filter((row) => inRange(row.saleDate));
    const prior = completed.filter((row) => inPrior(row.saleDate));

    const revenue = current.reduce((a, r) => a + r.total, 0);
    const priorRevenue = prior.reduce((a, r) => a + r.total, 0);
    const collected = payments.filter((p) => inRange(p.paymentDate)).reduce((a, p) => a + p.amount, 0);
    const priorCollected = payments.filter((p) => inPrior(p.paymentDate)).reduce((a, p) => a + p.amount, 0);
    const outstanding = current.reduce((a, r) => a + Math.max(0, r.total - r.amountPaid), 0);
    const returnTotal = returns.filter((r) => inRange(r.returnDate)).reduce((a, r) => a + r.total, 0);
    const priorReturns = returns.filter((r) => inPrior(r.returnDate)).reduce((a, r) => a + r.total, 0);
    const tax = current.reduce((a, r) => a + r.taxAmount, 0);
    const buyers = new Set(current.map((r) => r.customerId).filter(Boolean)).size;
    const avg = current.length > 0 ? revenue / current.length : 0;
    const priorAvg = prior.length > 0 ? priorRevenue / prior.length : 0;
    const currentIds = new Set(current.map((r) => r.id));
    const qty = saleItems.filter((i) => currentIds.has(i.saleId)).reduce((a, i) => a + i.quantity, 0);

    return {
      current, revenue, priorRevenue, collected, priorCollected, outstanding,
      returnTotal, priorReturns, tax, buyers, avg, priorAvg, qty,
      count: current.length, priorCount: prior.length, currentIds,
    };
  }, [sales, payments, returns, saleItems, days]);

  const trend = useMemo(() => {
    const keys = ["invoices", "revenue", "collected"];
    const invoicePoints = buildBuckets(stats.current, days, (r) => r.saleDate, (p) => { p.invoices += 1; }, keys);
    const revenuePoints = buildBuckets(stats.current, days, (r) => r.saleDate, (p, r) => { p.revenue += r.total; }, keys);
    const paymentPoints = buildBuckets(payments, days, (p) => p.paymentDate, (point, p) => { point.collected += p.amount; }, keys);
    return invoicePoints.map((point, i) => ({
      label: point.label,
      invoices: Number(point.invoices),
      revenue: Number(revenuePoints[i]?.revenue ?? 0),
      collected: Number(paymentPoints[i]?.collected ?? 0),
    }));
  }, [stats.current, payments, days]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number; orders: number }>();
    saleItems.filter((item) => stats.currentIds.has(item.saleId)).forEach((item) => {
      const key = item.productId || item.productName;
      const entry = map.get(key) ?? { name: item.productName, quantity: 0, revenue: 0, orders: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.lineTotal;
      entry.orders += 1;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [saleItems, stats.currentIds]);

  const metrics = [
    { label: "Revenue", value: formatMoney(stats.revenue), icon: Wallet, delta: pctChange(stats.revenue, stats.priorRevenue) },
    { label: "Invoices", value: String(stats.count), icon: Receipt, delta: pctChange(stats.count, stats.priorCount) },
    { label: "Collected", value: formatMoney(stats.collected), icon: Coins, delta: pctChange(stats.collected, stats.priorCollected) },
    { label: "Outstanding", value: formatMoney(stats.outstanding), icon: ClipboardList, delta: null },
    { label: "Average Sale", value: formatMoney(stats.avg), icon: TrendingUp, delta: pctChange(stats.avg, stats.priorAvg) },
    { label: "Units Sold", value: String(stats.qty), icon: ShoppingBag, delta: null },
    { label: "Returns", value: formatMoney(stats.returnTotal), icon: RotateCcw, delta: pctChange(stats.returnTotal, stats.priorReturns) },
    { label: "Buying Customers", value: String(stats.buyers), icon: Users, delta: null },
  ];

  const summary = [
    { label: "Invoices", value: String(stats.count), icon: Receipt, delta: pctChange(stats.count, stats.priorCount) },
    { label: "Revenue (TZS)", value: formatMoney(stats.revenue), icon: Wallet, delta: pctChange(stats.revenue, stats.priorRevenue) },
    { label: "Collected (TZS)", value: formatMoney(stats.collected), icon: Coins, delta: pctChange(stats.collected, stats.priorCollected) },
  ];

  return (
    <AnalyticsWorkspace
      title="Sales Reports"
      backTo="/m/sales"
      days={days}
      metrics={metrics}
      summary={summary}
      series={[
        { key: "invoices", label: "Invoices", color: "#fbbf24" },
        { key: "revenue", label: "Revenue (TZS)", color: "#34d399", axis: "right" },
        { key: "collected", label: "Collected (TZS)", color: "#38bdf8", axis: "right" },
      ]}
      trend={trend}
      report={{
        filename: `sales-report-${days}d`,
        title: "Sales Report",
        subtitle: `Last ${days} days · generated ${new Date().toLocaleString("en-GB")}`,
        summary: metrics.map((m) => [m.label, m.value] as [string, string]),
        headers: ["Product", "Qty sold", "Sales", "Revenue"],
        rows: topProducts.map((p) => [p.name, p.quantity, p.orders, Math.round(p.revenue)]),
      }}
    >
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="font-display text-base font-bold text-white">Top Products</h3>
        <div className="mt-3 divide-y divide-white/8">
          {topProducts.slice(0, 10).map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate text-white/80">{p.name}</span>
              <span className="shrink-0 text-xs text-white/45">{p.quantity} units</span>
              <span className="shrink-0 font-medium text-white">{formatMoney(p.revenue)}</span>
            </div>
          ))}
          {!topProducts.length ? <p className="py-3 text-xs text-white/40">No completed sales in this period.</p> : null}
        </div>
      </div>
    </AnalyticsWorkspace>
  );
}
