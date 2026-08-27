import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserPlus, TrendingUp, UserSearch, Filter, RotateCcw,
  Coins, ShoppingBag, ClipboardList, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { AnalyticsWorkspace, buildBuckets, pctChange } from "@/components/analytics/analytics-workspace";

export const Route = createFileRoute("/_authenticated/m/crm/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({ days: Number(search.days) || 30 }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { days } = Route.useSearch();

  const { data: customers = [] } = useQuery({
    queryKey: ["crm-analytics-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name,created_at,lifecycle_stage,source,converted_at,next_follow_up")).data ?? [],
  });
  const { data: interactions = [] } = useQuery({
    queryKey: ["crm-analytics-interactions", days],
    queryFn: async () => (await supabase.from("customer_interactions").select("id,occurred_at,next_follow_up")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["crm-analytics-sales"],
    queryFn: async () => (await supabase.from("sales").select("customer_id,total,created_at,status").eq("status", "completed")).data ?? [],
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const from = now - days * 86400_000;
    const priorFrom = now - days * 2 * 86400_000;

    const total = customers.length;
    const newInRange = (customers as any[]).filter((c) => new Date(c.created_at).getTime() >= from).length;
    const priorNew = (customers as any[]).filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t >= priorFrom && t < from;
    }).length;

    const salesInRange = (sales as any[]).filter((s) => new Date(s.created_at).getTime() >= from);
    const priorSales = (sales as any[]).filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t >= priorFrom && t < from;
    });

    const revenue = salesInRange.reduce((a, s) => a + Number(s.total || 0), 0);
    const priorRevenue = priorSales.reduce((a, s) => a + Number(s.total || 0), 0);
    const uniqueBuyers = new Set(salesInRange.map((s) => s.customer_id).filter(Boolean)).size;
    const priorBuyerSet = new Set(priorSales.map((s) => s.customer_id).filter(Boolean));
    const orders = salesInRange.length;
    const priorOrders = priorSales.length;

    const clv = uniqueBuyers > 0 ? revenue / uniqueBuyers : 0;
    const priorClv = priorBuyerSet.size > 0 ? priorRevenue / priorBuyerSet.size : 0;
    const freq = uniqueBuyers > 0 ? orders / uniqueBuyers : 0;
    const priorFreq = priorBuyerSet.size > 0 ? priorOrders / priorBuyerSet.size : 0;
    const acquisition = days > 0 ? newInRange / days : 0;
    const priorAcquisition = days > 0 ? priorNew / days : 0;
    const conversion = total > 0 ? (uniqueBuyers / total) * 100 : 0;
    const priorConversion = total > 0 ? (priorBuyerSet.size / total) * 100 : 0;
    const retention = priorBuyerSet.size > 0
      ? (Array.from(priorBuyerSet).filter((id) => salesInRange.some((s) => s.customer_id === id)).length / priorBuyerSet.size) * 100
      : 0;
    const growth = pctChange(newInRange, priorNew) ?? 0;
    const leads = (customers as any[]).filter((c) => ["lead", "prospect"].includes(c.lifecycle_stage)).length;
    const prospects = (customers as any[]).filter((c) => c.lifecycle_stage === "prospect").length;
    const converted = (customers as any[]).filter((c) => c.converted_at && new Date(c.converted_at).getTime() >= from).length;
    const followUpsDue = (customers as any[]).filter((c) => c.next_follow_up && new Date(`${c.next_follow_up}T00:00:00`).getTime() <= now).length;
    const followUpsCompleted = (interactions as any[]).filter((i) => new Date(i.occurred_at).getTime() >= from).length;
    const bySource = (customers as any[]).reduce<Record<string, number>>((result, customer) => { const source = customer.source || "Unattributed"; result[source] = (result[source] ?? 0) + 1; return result; }, {});

    return {
      total, newInRange, priorNew, growth, clv, priorClv, freq, priorFreq,
      acquisition, priorAcquisition, conversion, priorConversion, retention,
      orders, priorOrders, revenue, priorRevenue, uniqueBuyers, leads, prospects, converted, followUpsDue, followUpsCompleted, bySource,
    };
  }, [customers, sales, interactions, days]);

  const trend = useMemo(() => {
    const customerPoints = buildBuckets(customers as any[], days, (c) => c.created_at, (p) => { p.customers += 1; }, ["customers", "orders", "revenue"]);
    const salesPoints = buildBuckets(sales as any[], days, (s) => s.created_at, (p) => { p.orders += 1; }, ["customers", "orders", "revenue"]);
    const revenueByBucket = buildBuckets(sales as any[], days, (s) => s.created_at, (p, s: any) => { p.revenue += Number(s.total || 0); }, ["customers", "orders", "revenue"]);
    return customerPoints.map((point, index) => ({
      label: point.label,
      customers: Number(point.customers),
      orders: Number(salesPoints[index]?.orders ?? 0),
      revenue: Number(revenueByBucket[index]?.revenue ?? 0),
    }));
  }, [customers, sales, days]);

  const metrics = [
    { label: "Total Customers", value: String(stats.total), icon: Users, delta: null },
    { label: "New (period)", value: String(stats.newInRange), icon: UserPlus, delta: pctChange(stats.newInRange, stats.priorNew) },
    { label: "Growth", value: `${stats.growth.toFixed(1)}%`, icon: TrendingUp, delta: stats.growth },
    { label: "Acquisition/day", value: stats.acquisition.toFixed(2), icon: UserSearch, delta: pctChange(stats.acquisition, stats.priorAcquisition) },
    { label: "Conversion", value: `${stats.conversion.toFixed(1)}%`, icon: Filter, delta: pctChange(stats.conversion, stats.priorConversion) },
    { label: "Retention", value: `${stats.retention.toFixed(1)}%`, icon: RotateCcw, delta: null },
    { label: "Lifetime Value", value: money(stats.clv), icon: Coins, delta: pctChange(stats.clv, stats.priorClv) },
    { label: "Purchase Frequency", value: stats.freq.toFixed(2), icon: ShoppingBag, delta: pctChange(stats.freq, stats.priorFreq) },
    { label: "Orders", value: String(stats.orders), icon: ClipboardList, delta: pctChange(stats.orders, stats.priorOrders) },
    { label: "Revenue", value: money(stats.revenue), icon: Wallet, delta: pctChange(stats.revenue, stats.priorRevenue) },
    { label: "Leads", value: String(stats.leads), icon: UserSearch, delta: null },
    { label: "Prospects", value: String(stats.prospects), icon: UserSearch, delta: null },
    { label: "Converted", value: String(stats.converted), icon: UserPlus, delta: null },
    { label: "Follow-ups due", value: String(stats.followUpsDue), icon: ClipboardList, delta: null },
    { label: "Follow-ups completed", value: String(stats.followUpsCompleted), icon: ClipboardList, delta: null },
  ];

  const sourceSummary = Object.entries(stats.bySource).map(([source, count]) => `${source}: ${count}`).join(" · ");
  const summary = [
    { label: "New Customers", value: String(stats.newInRange), icon: Users, delta: pctChange(stats.newInRange, stats.priorNew) },
    { label: "Orders", value: String(stats.orders), icon: ClipboardList, delta: pctChange(stats.orders, stats.priorOrders) },
    { label: "Revenue (TZS)", value: money(stats.revenue), icon: Wallet, delta: pctChange(stats.revenue, stats.priorRevenue) },
    { label: "Leads / prospects", value: `${stats.leads} / ${stats.prospects}`, icon: UserSearch, delta: null },
    { label: "Customers by source", value: sourceSummary || "No source data", icon: Users, delta: null },
  ];

  return (
    <AnalyticsWorkspace
      title="Customer Analytics"
      backTo="/m/crm"
      days={days}
      metrics={metrics}
      summary={summary}
      series={[
        { key: "customers", label: "New Customers", color: "#fbbf24" },
        { key: "orders", label: "Orders", color: "#38bdf8" },
        { key: "revenue", label: "Revenue (TZS)", color: "#34d399", axis: "right" },
      ]}
      trend={trend}
      report={{
        filename: `customer-analytics-${days}d`,
        title: "Customer Analytics",
        subtitle: `Last ${days} days · generated ${new Date().toLocaleString("en-GB")}`,
        summary: metrics.map((m) => [m.label, m.value] as [string, string]),
        headers: ["Period", "New customers", "Orders", "Revenue"],
        rows: trend.map((p) => [p.label, p.customers, p.orders, Math.round(p.revenue)]),
      }}
    />
  );
}
