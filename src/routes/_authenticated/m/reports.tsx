import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import {
  BarChart3, TrendingUp, PieChart as PieChartIcon, Package,
  Home, Scan, Users, MoreHorizontal, ChevronRight, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/m/reports")({ component: Reports });

function Reports() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [sales, expenses, saleItems] = await Promise.all([
        supabase.from("sales").select("total,created_at,payment_method").eq("status", "completed"),
        supabase.from("expenses").select("amount,expense_date"),
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
      (expenses.data ?? []).forEach((e) => {
        const d = new Date(e.expense_date);
        const k = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        const b = months.find((x) => x.month === k); if (b) b.expenses += Number(e.amount);
      });
      const methodAgg: Record<string, number> = {};
      (sales.data ?? []).forEach((s) => { methodAgg[s.payment_method] = (methodAgg[s.payment_method] ?? 0) + Number(s.total); });
      const methods = Object.entries(methodAgg).map(([name, value]) => ({ name: name.replace("_"," "), value }));
      const prodAgg: Record<string, number> = {};
      (saleItems.data ?? []).forEach((it: any) => { prodAgg[it.product_name] = (prodAgg[it.product_name] ?? 0) + Number(it.line_total); });
      const topProducts = Object.entries(prodAgg).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }));
      return { months, methods, topProducts };
    },
  });

  const cards = [
    { label: "Sales", icon: TrendingUp, onClick: () => toast.info("View sales reports") },
    { label: "Expenses", icon: BarChart3, onClick: () => toast.info("View expense reports") },
    { label: "Methods", icon: PieChartIcon, onClick: () => toast.info("Payment methods report") },
    { label: "Products", icon: Package, onClick: () => toast.info("Product sales report") },
  ];

  const moreItems = [
    { label: "Monthly Trends", icon: TrendingUp, onClick: () => toast.info("Monthly trends — coming soon") },
    { label: "Customer Analysis", icon: Users, onClick: () => toast.info("Customer analysis — coming soon") },
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

        {/* Sales vs Expenses Card */}
        <button
          onClick={() => toast.info("View detailed analytics")}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-white/15 backdrop-blur-xl p-5 text-left transition hover:scale-[1.02] hover:bg-white/25 border border-white/30"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15 backdrop-blur">
            <TrendingUp className="h-6 w-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold text-white">Last 6 Months</h3>
            <p className="text-xs text-white/70">Sales vs Expenses trends</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/60" />
        </button>
      </div>

    </div>
  );
}

