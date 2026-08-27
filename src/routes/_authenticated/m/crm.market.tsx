import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Plus, Pencil, Trash2, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/format";
import { CrmShell, GlassCard } from "@/components/crm/crm-shell";
import { SummaryStrip, StatusBadge, TaxEmptyState } from "@/components/tax/tax-workspace";
import { TopDrawer, Field, inputCls } from "@/components/crm/top-drawer";
import {
  useCrmIntel, marketPosition, campaignEconomics, opportunityLevel,
  type MarketAudience,
} from "@/components/crm/crm-intel-provider";

export const Route = createFileRoute("/_authenticated/m/crm/market")({
  head: () => ({
    meta: [
      { title: "Market Intelligence — Customers & CRM" },
      { name: "description", content: "Customers available, reachable market, customers served, penetration and where to invest next." },
      { property: "og:title", content: "Market Intelligence — Customers & CRM" },
      { property: "og:description", content: "Understand market size, reach and remaining opportunity for your business." },
    ],
  }),
  component: MarketPage,
});

type Form = { name: string; region: string; available: number; reach: number; channels: string; notes: string };
const empty: Form = { name: "", region: "", available: 0, reach: 0, channels: "", notes: "" };

function MarketPage() {
  const { audiences, market, saveAudience, removeAudience, allCampaignIntel } = useCrmIntel();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketAudience | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const { data: served = 0 } = useQuery({
    queryKey: ["crm-market-served"],
    queryFn: async () => (await supabase.from("customers").select("id", { count: "exact", head: true })).count ?? 0,
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["crm-campaigns"],
    queryFn: async () => (await supabase.from("marketing_campaigns").select("*")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["crm-market-sales"],
    queryFn: async () =>
      (await supabase.from("sales").select("customer_id,total,status").eq("status", "completed")).data ?? [],
  });

  const pos = marketPosition(market.available, market.reach, Number(served));

  const economics = useMemo(() => {
    let cost = 0, leads = 0, acquired = 0, revenue = 0;
    for (const c of campaigns as any[]) {
      const intel = allCampaignIntel.find((i) => i.campaignId === c.id);
      if (!intel) { cost += Number(c.budget || 0); continue; }
      const e = campaignEconomics(Number(c.budget || 0), intel);
      cost += e.cost; leads += e.leads; acquired += e.acquired; revenue += e.revenue;
    }
    const buyers = new Set((sales as any[]).map((s) => s.customer_id).filter(Boolean));
    const customerRevenue = (sales as any[]).reduce((a, s) => a + Number(s.total || 0), 0);
    const customerValue = buyers.size > 0 ? customerRevenue / buyers.size : 0;
    return {
      cost, leads, acquired, revenue, customerValue,
      cac: acquired > 0 ? cost / acquired : 0,
      conversion: leads > 0 ? (acquired / leads) * 100 : 0,
    };
  }, [campaigns, allCampaignIntel, sales]);

  const overall = opportunityLevel({
    unservedReach: pos.unservedReach,
    conversion: economics.conversion,
    cac: economics.cac,
    customerValue: economics.customerValue,
  });

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (a: MarketAudience) => {
    setEditing(a);
    setForm({ name: a.name, region: a.region, available: a.available, reach: a.reach, channels: a.channels.join(", "), notes: a.notes ?? "" });
    setOpen(true);
  };
  const submit = () => {
    if (!form.name.trim()) return;
    saveAudience({
      id: editing?.id,
      name: form.name.trim(),
      region: form.region.trim(),
      available: Number(form.available) || 0,
      reach: Math.min(Number(form.reach) || 0, Number(form.available) || 0),
      channels: form.channels.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes.trim() || undefined,
    });
    setOpen(false); setEditing(null); setForm(empty);
  };

  return (
    <CrmShell
      title="Market Intelligence"
      subtitle="Customers available → reachable market → customers served"
      action={
        <button onClick={openCreate} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold hover:bg-amber-400/30 md:flex-none">
          <Plus className="h-4 w-4" /> Define Audience
        </button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Customers available", value: pos.available.toLocaleString() },
          { label: "Reach market", value: pos.reach.toLocaleString(), hint: `${pos.reachCoverage.toFixed(1)}% of available` },
          { label: "Customers served", value: pos.served.toLocaleString(), accent: true },
          { label: "Unserved reach", value: pos.unservedReach.toLocaleString(), tone: "warning" },
          { label: "Market penetration", value: `${pos.penetration.toFixed(1)}%` },
          { label: "Reach → service", value: `${pos.reachConversion.toFixed(1)}%` },
          { label: "Avg customer value", value: money(economics.customerValue) },
          { label: "Acquisition cost", value: economics.cac > 0 ? money(economics.cac) : "—" },
        ]}
      />

      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-300" />
          <h2 className="font-display text-lg font-bold">Investment intelligence</h2>
          <span className="ml-auto"><StatusBadge value={overall.level} /></span>
        </div>
        <p className="mt-2 text-sm text-white/70">{overall.reason}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Mini label="Marketing spend" value={money(economics.cost)} />
          <Mini label="Leads" value={economics.leads.toLocaleString()} />
          <Mini label="Customers acquired" value={economics.acquired.toLocaleString()} />
          <Mini label="Campaign revenue" value={money(economics.revenue)} />
        </div>
      </GlassCard>

      {audiences.length === 0 ? (
        <TaxEmptyState
          icon={Globe2}
          title="Define your market"
          description="Add the audiences you sell to with their estimated size and how many of them you can reach today. Penetration, unserved market and investment signals are derived from these figures."
          actionLabel="Define Audience"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {audiences.map((a) => {
            const share = market.available > 0 ? a.available / market.available : 0;
            const audServed = Math.round(Number(served) * share);
            const p = marketPosition(a.available, a.reach, audServed);
            const signal = opportunityLevel({
              unservedReach: p.unservedReach,
              conversion: economics.conversion,
              cac: economics.cac,
              customerValue: economics.customerValue,
            });
            return (
              <GlassCard key={a.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/20">
                    <Users className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="text-[11px] uppercase tracking-wider text-white/60">{a.region || "All regions"}</p>
                  </div>
                  <StatusBadge value={signal.level} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Mini label="Available" value={a.available.toLocaleString()} />
                  <Mini label="Reach" value={a.reach.toLocaleString()} />
                  <Mini label="Unserved reach" value={p.unservedReach.toLocaleString()} />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-amber-400/70" style={{ width: `${Math.min(p.reachCoverage, 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-white/50">
                  Reach covers {p.reachCoverage.toFixed(1)}% of this audience · penetration {p.penetration.toFixed(1)}%
                </p>
                {a.channels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.channels.map((ch) => (
                      <span key={ch} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">{ch}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  <button onClick={() => openEdit(a)} className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
                    <Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => { if (confirm("Remove audience?")) removeAudience(a.id); }}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-red-500/20 hover:bg-red-500/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <TopDrawer
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? "Edit Audience" : "Define Audience"}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm">Cancel</button>
            <button onClick={submit} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">Save</button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Audience name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Region / area"><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inputCls} /></Field>
          <Field label="Customers available (estimate)"><input type="number" min={0} value={form.available} onChange={(e) => setForm({ ...form, available: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Reachable with current channels"><input type="number" min={0} value={form.reach} onChange={(e) => setForm({ ...form, reach: Number(e.target.value) })} className={inputCls} /></Field>
          <div className="md:col-span-2">
            <Field label="Channels used to reach them (comma separated)"><input value={form.channels} onChange={(e) => setForm({ ...form, channels: e.target.value })} className={inputCls} placeholder="Instagram, WhatsApp, Referral" /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + " min-h-20"} /></Field>
          </div>
        </div>
      </TopDrawer>
    </CrmShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-1 font-display text-base font-bold">{value}</p>
    </div>
  );
}
