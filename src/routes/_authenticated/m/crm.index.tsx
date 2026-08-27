import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { UserRound, Users, Megaphone, BarChart3, Globe2, ChevronRight, UserPlus, Radio } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { SummaryStrip } from "@/components/tax/tax-workspace";
import { useCrmIntel, marketPosition, campaignEconomics } from "@/components/crm/crm-intel-provider";

export const Route = createFileRoute("/_authenticated/m/crm/")({ component: CrmHub });

function CrmHub() {
  const navigate = useNavigate();
  const { market, allCampaignIntel } = useCrmIntel();

  const { data: stats } = useQuery({
    queryKey: ["crm-hub-stats"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const [totalRes, thisMonthRes, prevMonthRes, salesRes, campaignRes] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", prevStart).lt("created_at", monthStart),
        supabase.from("sales").select("total,customer_id").eq("status", "completed"),
        supabase.from("marketing_campaigns").select("id,budget,status"),
      ]);
      const total = totalRes.count ?? 0;
      const thisMonth = thisMonthRes.count ?? 0;
      const prev = prevMonthRes.count ?? 0;
      const growth = prev > 0 ? ((thisMonth - prev) / prev) * 100 : thisMonth > 0 ? 100 : 0;
      const withCust = (salesRes.data ?? []).filter((s) => s.customer_id);
      const totalRevenue = withCust.reduce((a, s) => a + Number(s.total || 0), 0);
      const uniqueBuyers = new Set(withCust.map((s) => s.customer_id)).size;
      const avg = uniqueBuyers > 0 ? totalRevenue / uniqueBuyers : 0;
      return { total, thisMonth, growth, avg, campaigns: campaignRes.data ?? [] };
    },
  });

  const pos = marketPosition(market.available, market.reach, stats?.total ?? 0);

  const marketing = (() => {
    let cost = 0, acquired = 0, revenue = 0, active = 0;
    for (const c of (stats?.campaigns ?? []) as any[]) {
      if (c.status === "active") active += 1;
      const intel = allCampaignIntel.find((i) => i.campaignId === c.id);
      if (!intel) { cost += Number(c.budget || 0); continue; }
      const e = campaignEconomics(Number(c.budget || 0), intel);
      cost += e.cost; acquired += e.acquired; revenue += e.revenue;
    }
    return {
      active,
      acquired,
      cac: acquired > 0 ? cost / acquired : 0,
      roi: cost > 0 ? ((revenue - cost) / cost) * 100 : 0,
    };
  })();

  const cards = [
    { label: "Customers", icon: Users, onClick: () => navigate({ to: "/m/crm/customers" }) },
    { label: "Market", icon: Globe2, onClick: () => navigate({ to: "/m/crm/market" }) },
    { label: "Campaigns", icon: Megaphone, onClick: () => navigate({ to: "/m/crm/campaigns" }) },
    { label: "Analytics", icon: BarChart3, onClick: () => navigate({ to: "/m/crm/analytics", search: { days: 30 } }) },
  ];

  const moreItems = [
    { label: "New Customer", icon: UserPlus, onClick: () => navigate({ to: "/m/crm/customers", search: { new: 1 } as any }) },
    { label: "Reach Channels", icon: Radio, onClick: () => navigate({ to: "/m/crm/channels" }) },
    { label: "Customer Analytics", icon: BarChart3, onClick: () => navigate({ to: "/m/crm/analytics", search: { days: 30 } }) },
  ];

  const summary = [
    { label: "Total Customers", value: String(stats?.total ?? 0) },
    { label: "New This Month", value: String(stats?.thisMonth ?? 0) },
    { label: "Customer Growth", value: `${(stats?.growth ?? 0).toFixed(0)}%`, tone: (stats?.growth ?? 0) < 0 ? ("danger" as const) : ("success" as const) },
    { label: "Avg Customer Value", value: money(stats?.avg ?? 0), accent: true },
    { label: "Customers Available", value: pos.available.toLocaleString(), hint: pos.available === 0 ? "Define your market" : undefined },
    { label: "Reach Market", value: pos.reach.toLocaleString() },
    { label: "Market Penetration", value: `${pos.penetration.toFixed(1)}%` },
    { label: "Active Campaigns", value: String(marketing.active) },
    { label: "Customers Acquired", value: String(marketing.acquired) },
    { label: "Acquisition Cost", value: marketing.cac > 0 ? money(marketing.cac) : "—" },
    { label: "Campaign ROI", value: marketing.roi !== 0 ? `${marketing.roi.toFixed(0)}%` : "—", tone: marketing.roi < 0 ? ("danger" as const) : ("success" as const) },
    { label: "Unserved Reach", value: pos.unservedReach.toLocaleString(), tone: "warning" as const },
  ];

  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden text-white">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6 md:max-w-6xl md:px-10 md:pb-12 md:pt-10">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur-xl">
            <UserRound className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Customers & CRM</h1>
            <p className="text-sm text-white/80">Customers, market, campaigns & investment intelligence</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-4 md:mt-12 md:gap-8">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={c.onClick}
              className="group flex flex-col items-center gap-3 transition hover:scale-110 md:gap-4"
            >
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/30 bg-amber-400/15 backdrop-blur-xl transition group-hover:bg-amber-400/25 group-hover:shadow-lg group-hover:shadow-amber-400/20 md:h-28 md:w-28 md:rounded-3xl">
                <c.icon className="h-6 w-6 text-amber-400 md:h-10 md:w-10" />
              </div>
              <span className="text-center text-[11px] font-semibold text-white md:text-sm">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8">
          <SummaryStrip items={summary} />
        </div>

        {(stats?.total ?? 0) === 0 || pos.available === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
            <h2 className="font-display text-base font-semibold text-white">Get your CRM working</h2>
            <p className="mt-1 text-sm text-white/55">Complete these steps to turn the module into real customer & market intelligence.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { label: "Add your first customer", to: "/m/crm/customers" as const },
                { label: "Define your market (customers available & reach)", to: "/m/crm/market" as const },
                { label: "Create your first campaign", to: "/m/crm/campaigns" as const },
              ].map((step) => (
                <li key={step.label}>
                  <Link to={step.to} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 transition hover:bg-white/10">
                    <span className="flex-1 text-white/80">{step.label}</span>
                    <ChevronRight className="h-4 w-4 text-white/50" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 rounded-3xl border border-white/30 bg-white/10 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">More Options</h2>
          </div>
          <div className="mt-3 h-px bg-white/20" />
          <ul className="mt-2 divide-y divide-white/20">
            {moreItems.map((t) => (
              <li key={t.label}>
                <button onClick={t.onClick} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/10">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 backdrop-blur">
                    <t.icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="flex-1 text-[15px] font-medium text-white">{t.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/60" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
