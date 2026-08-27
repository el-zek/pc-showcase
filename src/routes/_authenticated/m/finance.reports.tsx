import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Coins, Landmark, Layers, Wallet, Receipt } from "lucide-react";
import { AnalyticsWorkspace, buildBuckets, pctChange } from "@/components/analytics/analytics-workspace";
import { formatMoney, useFinance } from "@/components/finance/finance-provider";

export const Route = createFileRoute("/_authenticated/m/finance/reports")({
  validateSearch: (search: Record<string, unknown>) => ({ days: Number(search.days) || 30 }),
  component: FinanceReports,
});

function FinanceReports() {
  const { days } = Route.useSearch();
  const { payments, transfers, accounts, audit, metrics } = useFinance();

  const stats = useMemo(() => {
    const now = Date.now();
    const from = now - days * 86400_000;
    const priorFrom = now - days * 2 * 86400_000;
    const inRange = (d: string) => new Date(d).getTime() >= from;
    const inPrior = (d: string) => {
      const t = new Date(d).getTime();
      return t >= priorFrom && t < from;
    };
    const completed = payments.filter((row) => row.status === "Completed");
    const current = completed.filter((row) => inRange(row.paymentDate));
    const prior = completed.filter((row) => inPrior(row.paymentDate));
    const sum = (rows: typeof completed, dir: "in" | "out") =>
      rows.filter((row) => row.direction === dir).reduce((a, r) => a + r.amount, 0);

    const moneyIn = sum(current, "in");
    const moneyOut = sum(current, "out");
    const priorIn = sum(prior, "in");
    const priorOut = sum(prior, "out");
    const transferTotal = transfers.filter((row) => row.status === "Completed" && inRange(row.transferDate)).reduce((a, r) => a + r.amount, 0);
    const priorTransfers = transfers.filter((row) => row.status === "Completed" && inPrior(row.transferDate)).reduce((a, r) => a + r.amount, 0);

    const byType: Record<string, number> = {};
    current.forEach((row) => { byType[row.paymentType] = (byType[row.paymentType] ?? 0) + row.amount; });

    return { current, moneyIn, moneyOut, priorIn, priorOut, transferTotal, priorTransfers, byType };
  }, [payments, transfers, days]);

  const trend = useMemo(() => {
    const keys = ["moneyIn", "moneyOut", "transfers"];
    const inPoints = buildBuckets(payments.filter((r) => r.status === "Completed" && r.direction === "in"), days, (r) => r.paymentDate, (p, r) => { p.moneyIn += r.amount; }, keys);
    const outPoints = buildBuckets(payments.filter((r) => r.status === "Completed" && r.direction === "out"), days, (r) => r.paymentDate, (p, r) => { p.moneyOut += r.amount; }, keys);
    const transferPoints = buildBuckets(transfers.filter((r) => r.status === "Completed"), days, (r) => r.transferDate, (p, r) => { p.transfers += r.amount; }, keys);
    return inPoints.map((point, i) => ({
      label: point.label,
      moneyIn: Number(point.moneyIn),
      moneyOut: Number(outPoints[i]?.moneyOut ?? 0),
      transfers: Number(transferPoints[i]?.transfers ?? 0),
    }));
  }, [payments, transfers, days]);

  const cards = [
    { label: "Money In", value: formatMoney(stats.moneyIn), icon: ArrowDownLeft, delta: pctChange(stats.moneyIn, stats.priorIn) },
    { label: "Money Out", value: formatMoney(stats.moneyOut), icon: ArrowUpRight, delta: pctChange(stats.moneyOut, stats.priorOut) },
    { label: "Net Cash Flow", value: formatMoney(stats.moneyIn - stats.moneyOut), icon: Coins, delta: pctChange(stats.moneyIn - stats.moneyOut, stats.priorIn - stats.priorOut) },
    { label: "Total Balance", value: formatMoney(metrics.totalBalance), icon: Wallet, delta: null },
    { label: "Transfers", value: formatMoney(stats.transferTotal), icon: ArrowLeftRight, delta: pctChange(stats.transferTotal, stats.priorTransfers) },
    { label: "Payments", value: String(stats.current.length), icon: Receipt, delta: null },
    { label: "Active Accounts", value: String(metrics.activeAccounts), icon: Landmark, delta: null },
    { label: "Audit Entries", value: String(audit.length), icon: Layers, delta: null },
  ];

  const summary = [
    { label: "Accounts tracked", value: String(accounts.length), icon: Landmark, delta: null },
    { label: "Completed transfers", value: String(transfers.filter((r) => r.status === "Completed").length), icon: ArrowLeftRight, delta: null },
    { label: "Pending payments", value: String(payments.filter((r) => r.status === "Pending").length), icon: Receipt, delta: null },
  ];

  const typeRows = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);

  return (
    <AnalyticsWorkspace
      title="Financial Reports"
      backTo="/m/finance"
      days={days}
      metrics={cards}
      summary={summary}
      series={[
        { key: "moneyIn", label: "Money In (TZS)", color: "#34d399", axis: "right" },
        { key: "moneyOut", label: "Money Out (TZS)", color: "#fb7185", axis: "right" },
        { key: "transfers", label: "Transfers (TZS)", color: "#38bdf8" },
      ]}
      trend={trend}
      report={{
        filename: `finance-report-${days}d`,
        title: "Financial Report",
        subtitle: `Last ${days} days · generated ${new Date().toLocaleString("en-GB")}`,
        summary: cards.map((c) => [c.label, c.value] as [string, string]),
        headers: ["Account", "Type", "Opening", "Movement", "Balance"],
        rows: accounts.map((row) => [row.name, row.accountType, row.openingBalance, row.movement, row.currentBalance]),
      }}
    >
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="font-display text-base font-bold text-white">Account Balances</h3>
          <div className="mt-3 divide-y divide-white/8">
            {accounts.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-white/80">{row.name}</span>
                <span className="shrink-0 text-xs text-white/45">{row.accountType}</span>
                <span className="shrink-0 text-xs font-medium text-amber-300">{formatMoney(row.currentBalance)}</span>
              </div>
            ))}
            {!accounts.length ? <p className="py-3 text-xs text-white/40">No accounts yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="font-display text-base font-bold text-white">Payments by Type</h3>
          <div className="mt-3 divide-y divide-white/8">
            {typeRows.slice(0, 12).map(([type, amount]) => (
              <div key={type} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-white/80">{type}</span>
                <span className="shrink-0 text-xs font-medium text-white/70">{formatMoney(amount)}</span>
              </div>
            ))}
            {!typeRows.length ? <p className="py-3 text-xs text-white/40">No payments in this period.</p> : null}
          </div>
        </div>
      </div>
    </AnalyticsWorkspace>
  );
}
