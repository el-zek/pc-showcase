import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/m/business-performance")({
  component: BusinessPerformance,
});

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const inMonth = (value: string | null | undefined, month: string) =>
  Boolean(value) && String(value).slice(0, 7) === month;

function BusinessPerformance() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["business-performance"],
    queryFn: async () => {
      const [sales, expenses, activities, campaigns, results, customers] = await Promise.all([
        supabase.from("sales").select("id,total,sale_date,created_at,customer_id,status").eq("status", "completed"),
        supabase.from("tax_expenses").select("amount,date,status,category"),
        supabase.from("marketing_activities").select("cost,activity_date,campaign_id"),
        supabase.from("marketing_campaigns").select("id,name,budget,start_date"),
        supabase.from("campaign_results").select("campaign_id,leads,customers_acquired,revenue,extra_cost,created_at"),
        supabase.from("customers").select("id,created_at,acquired_campaign_id,converted_at"),
      ]);
      return {
        sales: sales.data ?? [],
        expenses: expenses.data ?? [],
        activities: activities.data ?? [],
        campaigns: campaigns.data ?? [],
        results: results.data ?? [],
        customers: customers.data ?? [],
      };
    },
  });

  const months = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i += 1) out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    return out;
  }, []);

  const m = useMemo(() => {
    const sales = (data?.sales ?? []).filter((s: any) => inMonth(s.sale_date ?? s.created_at, month));
    const expenses = (data?.expenses ?? []).filter((e: any) => e.status !== "Pending" && inMonth(e.date, month));
    const activities = (data?.activities ?? []).filter((a: any) => inMonth(a.activity_date, month));
    const campaignIds = new Set((data?.campaigns ?? []).map((c: any) => c.id));

    const revenue = sales.reduce((a: number, s: any) => a + Number(s.total || 0), 0);
    const orders = sales.length;
    const aov = orders > 0 ? revenue / orders : 0;

    const expenseTotal = expenses.reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const activitySpend = activities.reduce((a: number, x: any) => a + Number(x.cost || 0), 0);
    // Marketing spend recorded as expenses is already inside expenseTotal; activity cost is the
    // marketing ledger and is reported separately so it is never double counted in profit.
    const marketingExpense = expenses
      .filter((e: any) => String(e.category || "").toLowerCase().startsWith("marketing"))
      .reduce((a: number, e: any) => a + Number(e.amount || 0), 0);
    const marketingSpend = Math.max(activitySpend, marketingExpense);

    const netProfit = revenue - expenseTotal;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Customers
    const customersById = new Map((data?.customers ?? []).map((c: any) => [c.id, c]));
    const newCustomers = (data?.customers ?? []).filter((c: any) => inMonth(c.created_at, month)).length;
    const converted = (data?.customers ?? []).filter((c: any) => inMonth(c.converted_at, month)).length;

    // Attribution: only campaign-linked customers count as directly attributed.
    let attributed = 0;
    for (const s of sales as any[]) {
      const c = s.customer_id ? customersById.get(s.customer_id) : null;
      if (c && (c as any).acquired_campaign_id && campaignIds.has((c as any).acquired_campaign_id)) {
        attributed += Number(s.total || 0);
      }
    }
    const reported = (data?.results ?? [])
      .filter((r: any) => inMonth(r.created_at, month))
      .reduce((a: number, r: any) => a + Number(r.revenue || 0), 0);
    const unattributed = Math.max(revenue - attributed, 0);

    const leads = (data?.results ?? [])
      .filter((r: any) => inMonth(r.created_at, month))
      .reduce((a: number, r: any) => a + Number(r.leads || 0), 0);
    const acquired = (data?.results ?? [])
      .filter((r: any) => inMonth(r.created_at, month))
      .reduce((a: number, r: any) => a + Number(r.customers_acquired || 0), 0);

    const cpl = leads > 0 ? marketingSpend / leads : 0;
    const cac = acquired > 0 ? marketingSpend / acquired : 0;
    const conversion = leads > 0 ? (acquired / leads) * 100 : 0;
    const roi = marketingSpend > 0 ? ((attributed - marketingSpend) / marketingSpend) * 100 : 0;

    return {
      revenue, orders, aov, expenseTotal, marketingSpend, netProfit, margin,
      newCustomers, converted, attributed, reported, unattributed,
      leads, acquired, cpl, cac, conversion, roi,
      expensesByCategory: Object.entries(
        expenses.reduce<Record<string, number>>((acc, e: any) => {
          const k = e.category || "Uncategorised";
          acc[k] = (acc[k] ?? 0) + Number(e.amount || 0);
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    };
  }, [data, month]);

  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] text-white">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6 md:max-w-6xl md:px-10 md:pb-12 md:pt-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/m/reports" })}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 hover:bg-white/20"
            aria-label="Back to reports"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight">Monthly Performance</h1>
            <p className="truncate text-sm text-white/80">{label}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-white/60" htmlFor="month">Month</label>
          <select
            id="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none"
          >
            {months.map((key) => (
              <option key={key} value={key} className="bg-neutral-900">
                {new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          {isLoading ? <span className="text-xs text-white/50">Loading…</span> : null}
        </div>

        <Section title="Business result">
          <Stat label="Revenue" value={money(m.revenue)} />
          <Stat label="Expenses" value={money(m.expenseTotal)} />
          <Stat label="Net profit" value={money(m.netProfit)} tone={m.netProfit >= 0 ? "good" : "bad"} />
          <Stat label="Margin" value={`${m.margin.toFixed(1)}%`} tone={m.margin >= 0 ? "good" : "bad"} />
          <Stat label="Orders" value={String(m.orders)} />
          <Stat label="Average order" value={money(m.aov)} />
        </Section>

        <Section title="Customers">
          <Stat label="New customers" value={String(m.newCustomers)} />
          <Stat label="Converted" value={String(m.converted)} />
          <Stat label="Leads" value={String(m.leads)} />
          <Stat label="Acquired (campaigns)" value={String(m.acquired)} />
          <Stat label="Lead → customer" value={`${m.conversion.toFixed(1)}%`} />
        </Section>

        <Section title="Marketing">
          <Stat label="Marketing spend" value={money(m.marketingSpend)} />
          <Stat label="Cost per lead" value={m.cpl > 0 ? money(m.cpl) : "—"} />
          <Stat label="Acquisition cost" value={m.cac > 0 ? money(m.cac) : "—"} />
          <Stat label="ROI (attributed)" value={m.marketingSpend > 0 ? `${m.roi.toFixed(0)}%` : "—"} tone={m.roi >= 0 ? "good" : "bad"} />
        </Section>

        <Section title="Revenue attribution">
          <Stat label="Directly attributed" value={money(m.attributed)} hint="Sales from customers linked to a campaign" />
          <Stat label="Manually reported" value={money(m.reported)} hint="Entered on campaign results" />
          <Stat label="Unattributed" value={money(m.unattributed)} hint="Revenue with no campaign link" />
        </Section>

        <div className="mt-4 rounded-3xl border border-white/25 bg-white/10 p-5 backdrop-blur-xl">
          <h2 className="font-display text-lg font-bold">Expenses by category</h2>
          {m.expensesByCategory.length === 0 ? (
            <p className="mt-3 text-sm text-white/55">No confirmed expenses recorded for {label}.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/15">
              {m.expensesByCategory.map(([name, total]) => (
                <li key={name} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-white/80">{name}</span>
                  <span className="font-semibold">{money(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-3xl border border-white/25 bg-white/10 p-5 backdrop-blur-xl">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/55">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "bad" ? "text-rose-300" : tone === "good" ? "text-emerald-300" : "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-white/45">{hint}</p> : null}
    </div>
  );
}
