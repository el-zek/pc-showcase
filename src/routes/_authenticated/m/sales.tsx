import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart, FileText, Receipt, RotateCcw, History, Wallet, ClipboardList,
  ChevronRight, BarChart3,
} from "lucide-react";
import { SalesProvider } from "@/components/sales/sales-provider";
import { useScopedItems } from "@/components/scope-guard";

export const Route = createFileRoute("/_authenticated/m/sales")({ component: SalesHub });

function SalesHub() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isNested = pathname !== "/m/sales" && pathname.startsWith("/m/sales/");

  return (
    <SalesProvider>
      <div className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden px-5 pb-28 pt-6 text-white md:px-10 md:pt-8 lg:pb-10">
        {isNested ? <Outlet /> : <SalesOverview />}
      </div>
    </SalesProvider>
  );
}

function SalesOverview() {
  const cards = useScopedItems([
    { label: "New Sale", icon: ShoppingCart, to: "/m/sales/new" },
    { label: "Invoices", icon: Receipt, to: "/m/sales/invoices" },
    { label: "Quotations", icon: FileText, to: "/m/sales/quotations" },
    { label: "Payments", icon: Wallet, to: "/m/sales/payments" },
  ]);

  const moreItems = useScopedItems([
    { label: "Sales Orders", icon: ClipboardList, to: "/m/sales/orders" },
    { label: "Sales History", icon: History, to: "/m/sales/history" },
    { label: "Returns", icon: RotateCcw, to: "/m/sales/returns" },
    { label: "Draft Orders", icon: FileText, to: "/m/sales/drafts" },
  ]);

  return (
    <div className="mx-auto max-w-md md:max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20">
          <ShoppingCart className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-white/80">Selling to customers</p>
        </div>
      </div>

      {/* Main Cards - Icon Only - Glass Effect */}
      <div className="mt-8 md:mt-12 grid grid-cols-4 gap-4 md:gap-8">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group flex flex-col items-center gap-3 md:gap-4 transition hover:scale-110"
          >
            <div className="grid h-16 w-16 md:h-28 md:w-28 place-items-center rounded-2xl md:rounded-3xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20">
              <c.icon className="h-6 w-6 md:h-10 md:w-10 text-amber-400" />
            </div>
            <span className="text-center text-[11px] md:text-sm font-semibold text-white">{c.label}</span>
          </Link>
        ))}
      </div>

      {/* More Items Section - Glass */}
      <div className="mt-8 rounded-3xl border border-white/30 bg-white/10 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <History className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-lg font-bold text-white">More Options</h2>
        </div>
        <div className="mt-3 h-px bg-white/20" />
        <ul className="mt-2 divide-y divide-white/20">
          {moreItems.map((t) => (
            <li key={t.label}>
              <Link
                to={t.to}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                  <t.icon className="h-4 w-4 text-amber-400" />
                </div>
                <span className="flex-1 text-[15px] text-white font-medium">{t.label}</span>
                <ChevronRight className="h-4 w-4 text-white/60" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Reports Card - Glass */}
      <Link
        to="/m/sales/reports" search={{ days: 30 }}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-white/15 backdrop-blur-xl p-5 text-left transition hover:scale-[1.02] hover:bg-white/25 border border-white/30"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15 backdrop-blur">
          <BarChart3 className="h-6 w-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold text-white">Sales Reports</h3>
          <p className="text-xs text-white/70">Performance, top products, analytics</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60" />
      </Link>
    </div>
  );
}
