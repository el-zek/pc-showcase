import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Package, ChevronRight, Boxes, AlertTriangle, XCircle, Wallet, ArrowDownToLine, ArrowUpFromLine, Repeat, Layers } from "lucide-react";
import { useInventory, formatMoney, stockStatus } from "@/components/inventory/inventory-provider";
import { AnalyticsWorkspace, buildBuckets, pctChange } from "@/components/analytics/analytics-workspace";

export const Route = createFileRoute("/_authenticated/m/inventory/overview")({
  validateSearch: (search: Record<string, unknown>) => ({ days: Number(search.days) || 30 }),
  component: OverviewPage,
});

function OverviewPage() {
  const { days } = Route.useSearch();
  const { products, movements, metrics } = useInventory();

  const stats = useMemo(() => {
    const now = Date.now();
    const from = now - days * 86400_000;
    const priorFrom = now - days * 2 * 86400_000;
    const at = (row: { movementDate: string }) => new Date(row.movementDate).getTime();
    const current = movements.filter((m) => at(m) >= from);
    const prior = movements.filter((m) => at(m) >= priorFrom && at(m) < from);
    const sum = (list: typeof movements, type: string) =>
      list.filter((m) => m.type === type).reduce((a, m) => a + m.quantity, 0);

    return {
      stockIn: sum(current, "Stock In") + sum(current, "Purchase"),
      priorStockIn: sum(prior, "Stock In") + sum(prior, "Purchase"),
      stockOut: sum(current, "Stock Out"),
      priorStockOut: sum(prior, "Stock Out"),
      adjustments: sum(current, "Adjustment"),
      transfers: sum(current, "Transfer"),
      movementCount: current.length,
      priorMovementCount: prior.length,
    };
  }, [movements, days]);

  const trend = useMemo(() => {
    const keys = ["stockIn", "stockOut", "movements"];
    const inPoints = buildBuckets(movements.filter((m) => m.type === "Stock In" || m.type === "Purchase"), days, (m) => m.movementDate, (p, m) => { p.stockIn += m.quantity; }, keys);
    const outPoints = buildBuckets(movements.filter((m) => m.type === "Stock Out"), days, (m) => m.movementDate, (p, m) => { p.stockOut += m.quantity; }, keys);
    const allPoints = buildBuckets(movements, days, (m) => m.movementDate, (p) => { p.movements += 1; }, keys);
    return inPoints.map((point, i) => ({
      label: point.label,
      stockIn: Number(point.stockIn),
      stockOut: Number(outPoints[i]?.stockOut ?? 0),
      movements: Number(allPoints[i]?.movements ?? 0),
    }));
  }, [movements, days]);

  const lowStock = products.filter((row) => stockStatus(row) !== "In Stock");

  const cards = [
    { label: "Total Products", value: String(metrics.totalProducts), icon: Package, delta: null },
    { label: "Total Stock", value: String(metrics.totalStock), icon: Boxes, delta: null },
    { label: "Low Stock", value: String(metrics.lowStock), icon: AlertTriangle, delta: null },
    { label: "Out of Stock", value: String(metrics.outOfStock), icon: XCircle, delta: null },
    { label: "Stock Value", value: formatMoney(metrics.stockValue), icon: Wallet, delta: null },
    { label: "Stock In", value: String(stats.stockIn), icon: ArrowDownToLine, delta: pctChange(stats.stockIn, stats.priorStockIn) },
    { label: "Stock Out", value: String(stats.stockOut), icon: ArrowUpFromLine, delta: pctChange(stats.stockOut, stats.priorStockOut) },
    { label: "Transfers", value: String(stats.transfers), icon: Repeat, delta: null },
  ];

  const summary = [
    { label: "Movements", value: String(stats.movementCount), icon: Layers, delta: pctChange(stats.movementCount, stats.priorMovementCount) },
    { label: "Units In", value: String(stats.stockIn), icon: ArrowDownToLine, delta: pctChange(stats.stockIn, stats.priorStockIn) },
    { label: "Units Out", value: String(stats.stockOut), icon: ArrowUpFromLine, delta: pctChange(stats.stockOut, stats.priorStockOut) },
  ];

  return (
    <AnalyticsWorkspace
      title="Stock Overview"
      backTo="/m/inventory"
      days={days}
      metrics={cards}
      summary={summary}
      series={[
        { key: "stockIn", label: "Stock In", color: "#34d399" },
        { key: "stockOut", label: "Stock Out", color: "#fbbf24" },
        { key: "movements", label: "Movements", color: "#38bdf8" },
      ]}
      trend={trend}
      report={{
        filename: `stock-overview-${days}d`,
        title: "Stock Overview",
        subtitle: `Last ${days} days · generated ${new Date().toLocaleString("en-GB")}`,
        summary: cards.map((c) => [c.label, c.value] as [string, string]),
        headers: ["Product", "Category", "Stock", "Reorder", "Status"],
        rows: lowStock.map((row) => [row.name, row.category || "—", row.stockQuantity, row.reorderLevel, stockStatus(row)]),
      }}
    >
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="font-display text-base font-bold text-white">Low Stock Alerts</h3>
        <div className="mt-3 divide-y divide-white/8">
          {lowStock.slice(0, 12).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate text-white/80">{row.name}</span>
              <span className="shrink-0 text-xs text-white/45">{row.stockQuantity} / {row.reorderLevel}</span>
              <span className={`shrink-0 text-xs font-medium ${stockStatus(row) === "Out of Stock" ? "text-rose-400" : "text-amber-400"}`}>
                {stockStatus(row)}
              </span>
            </div>
          ))}
          {!lowStock.length ? <p className="py-3 text-xs text-white/40">Stock levels are healthy.</p> : null}
        </div>
      </div>

      <Link
        to="/m/inventory/stock"
        className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left transition hover:bg-white/[0.06]"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15">
          <Package className="h-6 w-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold text-white">Manage Stock</h3>
          <p className="text-xs text-white/60">Record stock in, stock out and adjustments · {formatMoney(metrics.stockValue)} on hand</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60" />
      </Link>
    </AnalyticsWorkspace>
  );
}
