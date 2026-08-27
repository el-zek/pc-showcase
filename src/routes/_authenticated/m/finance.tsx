import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Wallet, Landmark, Receipt, CreditCard, ArrowLeftRight, BarChart3, ChevronRight, ScrollText,
} from "lucide-react";
import { FinanceProvider, useFinance, formatMoney } from "@/components/finance/finance-provider";
import { useScopedItems } from "@/components/scope-guard";

export const Route = createFileRoute("/_authenticated/m/finance")({ component: FinanceHub });

function FinanceHub() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isNested = pathname !== "/m/finance" && pathname.startsWith("/m/finance/");

  return (
    <FinanceProvider>
      {isNested ? <Outlet /> : <FinanceOverview />}
    </FinanceProvider>
  );
}

function FinanceOverview() {
  const { metrics, accounts } = useFinance();

  const cards = useScopedItems([
    { label: "Accounts", icon: Landmark, to: "/m/finance/accounts" },
    { label: "Expenses", icon: Receipt, to: "/m/finance/expenses" },
    { label: "Payments", icon: CreditCard, to: "/m/finance/payments" },
    { label: "Transfers", icon: ArrowLeftRight, to: "/m/finance/transfers" },
  ]);

  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden text-white">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6 md:max-w-6xl md:px-10 md:pb-12 md:pt-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-xl">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Finance</h1>
            <p className="text-sm text-white/80">Business financial management</p>
          </div>
        </div>

        {/* Main Cards - Icon Only - Glass Effect */}
        <div className="mt-8 grid grid-cols-4 gap-4 md:mt-12 md:gap-8">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="group flex flex-col items-center gap-3 transition hover:scale-110 md:gap-4"
            >
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20 md:h-28 md:w-28 md:rounded-3xl">
                <c.icon className="h-6 w-6 text-amber-400 md:h-10 md:w-10" />
              </div>
              <span className="text-center text-[11px] font-semibold text-white md:text-sm">{c.label}</span>
            </Link>
          ))}
        </div>

        {/* Balances summary */}
        <div className="mt-8 rounded-3xl border border-white/30 bg-white/10 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
              <ScrollText className="h-5 w-5 text-white" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">Account Balances</h2>
            <span className="ml-auto text-xs text-white/70">{formatMoney(metrics.totalBalance)}</span>
          </div>
          <div className="mt-3 h-px bg-white/20" />
          <ul className="mt-2 divide-y divide-white/20">
            {accounts.length === 0 ? (
              <li className="py-3 text-sm text-white/60">No accounts yet. Add your first account.</li>
            ) : (
              accounts.slice(0, 5).map((account) => (
                <li key={account.id} className="flex items-center gap-3 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                    <Landmark className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{account.name}</span>
                  <span className="shrink-0 text-sm text-white/80">{formatMoney(account.currentBalance)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Financial Reports - Glass */}
        <Link
          to="/m/finance/reports"
          search={{ days: 30 }}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/30 bg-white/15 p-5 text-left backdrop-blur-xl transition hover:scale-[1.02] hover:bg-white/25"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15 backdrop-blur">
            <BarChart3 className="h-6 w-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold text-white">Financial Reports</h3>
            <p className="text-xs text-white/70">Cash flow, profit &amp; loss, balances</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/60" />
        </Link>
      </div>
    </div>
  );
}
