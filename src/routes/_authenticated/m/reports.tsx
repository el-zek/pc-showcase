import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import {
  BarChart3, TrendingUp, PieChart as PieChartIcon, Package,
  Home, Scan, Users, MoreHorizontal, ChevronRight, ShoppingCart,
} from "lucide-react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/m/reports")({ component: Reports });

function Reports() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [sales, expenses, saleItems] = await Promise.all([
        supabase.from("sales").select("total,created_at,payment_method").eq("status", "completed"),
        // tax_expenses is the authoritative expense ledger for the whole system.
        supabase.from("tax_expenses").select("amount,date,status,category"),
        supabase.from("sale_items").select("product_name,quantity,line_total"),
      ]);
      const months: { month: string; sales: number; expenses: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), sales: 0, expenses: 0 });
      }
      (sales.data ?? []).forEach((s) => {
        const d = new Date(s.created_at);
        const k = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        const b = months.find((x) => x.month === k); if (b) b.sales += Number(s.total);
      });
      (expenses.data ?? []).forEach((e: any) => {
        if (e.status === "Pending") return; // unconfirmed recurring occurrences are not actual spend yet
        const d = new Date(`${e.date}T00:00:00`);
        const k = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        const b = months.find((x) => x.month === k); if (b) b.expenses += Number(e.amount);
      });
      const methodAgg: Record<string, number> = {};
      (sales.data ?? []).forEach((s) => { methodAgg[s.payment_method] = (methodAgg[s.payment_method] ?? 0) + Number(s.total); });
      const methods = Object.entries(methodAgg).map(([name, value]) => ({ name: name.replace("_"," "), value }));
      const prodAgg: Record<string, number> = {};
      (saleItems.data ?? []).forEach((it: any) => { prodAgg[it.product_name] = (prodAgg[it.product_name] ?? 0) + Number(it.line_total); });
      const topProducts = Object.entries(prodAgg).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }));
      const catAgg: Record<string, number> = {};
      (expenses.data ?? []).forEach((e: any) => {
        if (e.status === "Pending") return;
        const k = e.category || "Uncategorised";
        catAgg[k] = (catAgg[k] ?? 0) + Number(e.amount);
      });
      const expenseCategories = Object.entries(catAgg).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }));
      return { months, methods, topProducts, expenseCategories };
    },
  });

  const [view, setView] = useState<"sales" | "expenses" | "methods" | "products">("sales");

  const cards = [
    { label: "Sales", icon: TrendingUp, onClick: () => setView("sales") },
    { label: "Expenses", icon: BarChart3, onClick: () => setView("expenses") },
    { label: "Methods", icon: PieChartIcon, onClick: () => setView("methods") },
    { label: "Products", icon: Package, onClick: () => setView("products") },
  ];

  const moreItems = [
    { label: "Monthly Business Performance", icon: TrendingUp, onClick: () => navigate({ to: "/m/business-performance" }) },
    { label: "Customer Analysis", icon: Users, onClick: () => navigate({ to: "/m/crm/analytics", search: { days: 30 } }) },
  ];


  return (
    <div
      className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden text-white"
    >
      <div className="mx-auto max-w-md md:max-w-6xl px-5 md:px-10 pb-28 md:pb-12 pt-6 md:pt-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-white/80">Business analytics & insights</p>
          </div>
        </div>

        {/* Main Cards - Icon Only - Glass Effect */}
        <div className="mt-8 md:mt-12 grid grid-cols-4 gap-4 md:gap-8">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={c.onClick}
              className="group flex flex-col items-center gap-3 md:gap-4 transition hover:scale-110"
            >
              <div className="grid h-16 w-16 md:h-28 md:w-28 place-items-center rounded-2xl md:rounded-3xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20">
                <c.icon className="h-6 w-6 md:h-10 md:w-10 text-amber-400" />
              </div>
              <span className="text-center text-[11px] md:text-sm font-semibold text-white">{c.label}</span>
            </button>
          ))}
        </div>

        {/* More Items Section - Glass */}
        <div className="mt-8 rounded-3xl border border-white/30 bg-white/10 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">More Reports</h2>
          </div>
          <div className="mt-3 h-px bg-white/20" />
          <ul className="mt-2 divide-y divide-white/20">
            {moreItems.map((t) => (
              <li key={t.label}>
                <button
                  onClick={t.onClick}
                  className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                    <t.icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="flex-1 text-[15px] text-white font-medium">{t.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/60" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Live report panel driven by the selected card */}
        <div className="mt-4 rounded-3xl border border-white/30 bg-white/10 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15">
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                {view === "sales" ? "Sales — last 6 months"
                  : view === "expenses" ? "Expenses — last 6 months"
                  : view === "methods" ? "Revenue by payment method"
                  : "Top products by revenue"}
              </h3>
              <p className="text-xs text-white/70">Live figures from your records</p>
            </div>
          </div>

          <div className="mt-4 h-64">
            {view === "methods" ? (
              (data?.methods.length ?? 0) === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data?.methods ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
                      {(data?.methods ?? []).map((_, i) => (
                        <Cell key={i} fill={["#fbbf24", "#38bdf8", "#34d399", "#f472b6", "#a78bfa"][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )
            ) : view === "products" ? (
              (data?.topProducts.length ?? 0) === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.topProducts ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Bar dataKey="total" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : view === "expenses" && (data?.expenseCategories.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.expenseCategories ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Bar dataKey="total" fill="#f87171" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.months ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="#34d399" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}


function Empty() {
  return <div className="grid h-full place-items-center text-sm text-white/55">No data recorded yet.</div>;
}
