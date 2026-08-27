import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit2, Trash2, Megaphone, Radio, LayoutTemplate, CalendarClock, BarChart3, Users } from "lucide-react";
import { toast } from "sonner";
import { CrmShell, GlassCard } from "@/components/crm/crm-shell";
import { TopDrawer, Field, inputCls } from "@/components/crm/top-drawer";
import { SummaryStrip, StatusBadge, TaxEmptyState } from "@/components/tax/tax-workspace";
import { money, dateFmt } from "@/lib/format";
import {
  useCrmIntel, campaignEconomics, emptyCampaignIntel, CAMPAIGN_TEMPLATES, OBJECTIVES,
  type CampaignIntel, type CampaignObjective,
} from "@/components/crm/crm-intel-provider";

export const Route = createFileRoute("/_authenticated/m/crm/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns & Channels — Customers & CRM" },
      { name: "description", content: "Plan campaigns from templates, schedule sharing, and measure channel performance, CAC and ROI." },
      { property: "og:title", content: "Campaigns & Channels — Customers & CRM" },
      { property: "og:description", content: "Campaign objectives, audiences, budgets and measurable results by channel." },
    ],
  }),
  component: CampaignsPage,
});

const CHANNELS = ["sms", "social", "whatsapp", "instagram", "facebook", "tiktok", "google", "website", "referral", "offline"] as const;
const STATUSES = ["draft", "active", "paused", "completed"] as const;
const TABS = [
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "channels", label: "Channels", icon: Radio },
  { key: "activities", label: "Activities", icon: LayoutTemplate },
  { key: "reach", label: "Reach", icon: Users },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "plan", label: "Sharing Plan", icon: CalendarClock },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Form = {
  name: string; description: string; budget: number; channel: string;
  status: string; start_date: string; end_date: string;
  objective: CampaignObjective; audience: string; segment: string; content: string; expectedCustomers: number;
};
const empty: Form = {
  name: "", description: "", budget: 0, channel: "social", status: "draft", start_date: "", end_date: "",
  objective: "awareness", audience: "", segment: "", content: "", expectedCustomers: 0,
};

function CampaignsPage() {
  const qc = useQueryClient();
  const { audiences, campaignIntel, allCampaignIntel, campaignAttribution, unattributedRevenue, saveCampaignIntel, sharePlan, saveSharePlanItem, removeSharePlanItem } = useCrmIntel();
  const [tab, setTab] = useState<TabKey>("campaigns");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [resultsFor, setResultsFor] = useState<any | null>(null);
  const [results, setResults] = useState<CampaignIntel | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ activity_date: new Date().toISOString().slice(0, 10), activity_group: "content", activity_type: "Short Videos / Reels", channel: "Instagram", quantity: 1, cost: 0, owner_name: "", campaign_id: "", result: "", notes: "" });
  const [reachForm, setReachForm] = useState({ period: new Date().toISOString().slice(0, 7), channel: "Instagram", reached: 0, contacted: 0, leads: 0, converted: 0, campaign_id: "", notes: "" });
  const [planForm, setPlanForm] = useState({
    id: undefined as string | undefined, campaignId: "", content: "", channel: "social",
    audience: "", publishDate: "", publishTime: "", owner: "", status: "planned" as const,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["crm-campaigns"],
    queryFn: async () => (await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: channels = [] } = useQuery({
    queryKey: ["crm-channels"],
    queryFn: async () => (await supabase.from("customer_channels").select("*").order("name")).data ?? [],
  });
  const { data: channelCustomers = [] } = useQuery({
    queryKey: ["crm-channel-customers"],
    queryFn: async () => (await supabase.from("customers").select("id,channel_id")).data ?? [],
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["crm-marketing-activities"],
    queryFn: async () => (await supabase.from("marketing_activities").select("*, marketing_campaigns(name)").order("activity_date", { ascending: false })).data ?? [],
  });
  const { data: reachRows = [] } = useQuery({
    queryKey: ["crm-marketing-reach"],
    queryFn: async () => (await supabase.from("marketing_reach").select("*, marketing_campaigns(name)").order("period", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        budget: Number(form.budget) || 0,
        channel: form.channel,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        objective: form.objective,
        segment: form.segment || null,
        content: form.content || null,
        expected_customers: Number(form.expectedCustomers) || 0,
        audience_id: audiences.find((audience) => audience.name === form.audience)?.id ?? null,
      };
      if (editing) {
        const { error } = await supabase.from("marketing_campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id as string;
      }
      const { data, error } = await supabase.from("marketing_campaigns").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      const base = campaignIntel(id);
      saveCampaignIntel({
        ...base,
        campaignId: id,
        objective: form.objective,
        audience: form.audience || undefined,
        segment: form.segment || undefined,
        content: form.content || undefined,
        expectedCustomers: Number(form.expectedCustomers) || 0,
      });
      toast.success(editing ? "Updated" : "Campaign saved");
      qc.invalidateQueries({ queryKey: ["crm-campaigns"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await supabase.from("marketing_campaigns").delete().eq("id", id)).error,
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["crm-campaigns"] }); },
  });
  const saveActivity = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("marketing_activities").insert({ ...activityForm, campaign_id: activityForm.campaign_id || null }); if (error) throw error; },
    onSuccess: () => { toast.success("Activity recorded"); qc.invalidateQueries({ queryKey: ["crm-marketing-activities"] }); setActivityForm({ ...activityForm, activity_type: "Short Videos / Reels", quantity: 1, cost: 0, owner_name: "", result: "", notes: "" }); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveReach = useMutation({
    mutationFn: async () => {
      const existing = await supabase.from("marketing_reach").select("id").eq("period", reachForm.period).eq("channel", reachForm.channel).maybeSingle();
      const payload = { ...reachForm, campaign_id: reachForm.campaign_id || null };
      const result = existing.data?.id
        ? await supabase.from("marketing_reach").update(payload).eq("id", existing.data.id)
        : await supabase.from("marketing_reach").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => { toast.success("Reach saved"); qc.invalidateQueries({ queryKey: ["crm-marketing-reach"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: any) => {
    const intel = campaignIntel(c.id);
    setEditing(c);
    setForm({
      name: c.name, description: c.description ?? "", budget: c.budget,
      channel: c.channel, status: c.status,
      start_date: c.start_date ?? "", end_date: c.end_date ?? "",
      objective: intel.objective, audience: intel.audience ?? "", segment: intel.segment ?? "",
      content: intel.content ?? "", expectedCustomers: intel.expectedCustomers ?? 0,
    });
    setOpen(true);
  };
  const useTemplate = (key: string) => {
    const t = CAMPAIGN_TEMPLATES.find((x) => x.key === key)!;
    setEditing(null);
    setForm({ ...empty, name: t.label, objective: t.objective, channel: t.channel, content: t.content, description: t.content });
    setTab("campaigns");
    setOpen(true);
  };

  const totals = useMemo(() => {
    let cost = 0, reach = 0, leads = 0, acquired = 0, revenue = 0, active = 0, attributed = 0, reported = 0;
    for (const c of campaigns as any[]) {
      if (c.status === "active") active += 1;
      const intel = allCampaignIntel.find((i) => i.campaignId === c.id);
      const e = campaignEconomics(Number(c.budget || 0), intel ?? emptyCampaignIntel(c.id), campaignAttribution(c.id));
      cost += e.cost; leads += e.leads; acquired += e.acquired; revenue += e.revenue;
      attributed += e.attributedRevenue; reported += e.reportedRevenue;
      reach += Number(intel?.reach ?? 0);
    }
    return {
      cost, reach, leads, acquired, revenue, active, attributed, reported,
      cac: acquired > 0 ? cost / acquired : 0,
      cpl: leads > 0 ? cost / leads : 0,
      conversion: leads > 0 ? (acquired / leads) * 100 : 0,
      roi: cost > 0 ? ((revenue - cost) / cost) * 100 : 0,
      roas: cost > 0 ? revenue / cost : 0,
    };
  }, [campaigns, allCampaignIntel, campaignAttribution]);

  const channelPerf = useMemo(() => {
    const map = new Map<string, { channel: string; campaigns: number; cost: number; leads: number; acquired: number; revenue: number; customers: number }>();
    const byName = new Map<string, number>();
    for (const c of channelCustomers as any[]) {
      const ch = (channels as any[]).find((x) => x.id === c.channel_id);
      const name = (ch?.name ?? "").toLowerCase();
      if (name) byName.set(name, (byName.get(name) ?? 0) + 1);
    }
    for (const c of campaigns as any[]) {
      const key = String(c.channel);
      const intel = allCampaignIntel.find((i) => i.campaignId === c.id) ?? emptyCampaignIntel(c.id);
      const e = campaignEconomics(Number(c.budget || 0), intel, campaignAttribution(c.id));
      const row = map.get(key) ?? { channel: key, campaigns: 0, cost: 0, leads: 0, acquired: 0, revenue: 0, customers: byName.get(key) ?? 0 };
      row.campaigns += 1; row.cost += e.cost; row.leads += e.leads; row.acquired += e.acquired; row.revenue += e.revenue;
      map.set(key, row);
    }
    for (const [name, count] of byName) {
      if (!map.has(name)) map.set(name, { channel: name, campaigns: 0, cost: 0, leads: 0, acquired: 0, revenue: 0, customers: count });
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.acquired - a.acquired);
  }, [campaigns, channels, channelCustomers, allCampaignIntel, campaignAttribution]);


  return (
    <CrmShell
      title="Campaigns & Channels"
      subtitle={`${campaigns.length} campaigns · ${totals.active} active`}
      action={
        <button onClick={openCreate} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold hover:bg-amber-400/30 md:flex-none">
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      }
    >
      <SummaryStrip
        items={[
          { label: "Campaign spend", value: money(totals.cost) },
          { label: "Reach", value: totals.reach.toLocaleString() },
          { label: "Leads", value: totals.leads.toLocaleString() },
          { label: "Customers acquired", value: totals.acquired.toLocaleString(), accent: true },
          { label: "Cost per lead", value: totals.cpl > 0 ? money(totals.cpl) : "—" },
          { label: "Acquisition cost", value: totals.cac > 0 ? money(totals.cac) : "—" },
          { label: "Lead → customer", value: `${totals.conversion.toFixed(1)}%` },
          { label: "ROI / ROAS", value: totals.cost > 0 ? `${totals.roi.toFixed(0)}% · ${totals.roas.toFixed(2)}x` : "—", tone: totals.roi < 0 ? "danger" : "success" },
        ]}
      />

      {/* Attribution is never inferred: only sales of customers whose acquisition
          campaign is recorded count as directly attributed. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Mini label="Directly attributed revenue" value={money(totals.attributed)} />
        <Mini label="Manually reported revenue" value={money(totals.reported)} />
        <Mini label="Unattributed revenue" value={money(unattributedRevenue)} />
      </div>


      {/* sub-navigation (channels live here, not in main navigation) */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "border-amber-300/40 bg-amber-400/20 text-white"
                : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "campaigns" && (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <TaxEmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Start from a template or create a campaign to begin tracking reach, leads, acquisitions and ROI."
              actionLabel="New Campaign"
              onAction={openCreate}
            />
          ) : null}
          {(campaigns as any[]).map((c) => {
            const intel = campaignIntel(c.id);
            const attribution = campaignAttribution(c.id);
            const e = campaignEconomics(Number(c.budget || 0), intel, attribution);

            return (
              <GlassCard key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/20"><Megaphone className="h-5 w-5 text-amber-400" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge value={c.status} />
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">{c.channel}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">{intel.objective.replace(/_/g, " ")}</span>
                    </div>
                    {c.description && <p className="mt-2 line-clamp-2 text-xs text-white/60">{c.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/70">
                      <span>Budget: <b className="text-white">{money(c.budget)}</b></span>
                      {intel.audience ? <span>Audience: {intel.audience}</span> : null}
                      {c.start_date && <span>{dateFmt.format(new Date(c.start_date))}{c.end_date ? ` → ${dateFmt.format(new Date(c.end_date))}` : ""}</span>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Mini label="Leads" value={e.leads.toLocaleString()} />
                      <Mini label="Acquired" value={e.acquired.toLocaleString()} />
                      <Mini label="CAC" value={e.cac > 0 ? money(e.cac) : "—"} />
                      <Mini label="ROAS" value={e.cost > 0 ? `${e.roas.toFixed(2)}x` : "—"} />
                      <Mini label="Attributed revenue" value={money(e.attributedRevenue)} />
                      <Mini label="Attributed orders" value={e.attributedOrders.toLocaleString()} />
                      <Mini label="Reported revenue" value={e.reportedRevenue > 0 ? money(e.reportedRevenue) : "—"} />
                      <Mini label="ROI" value={e.cost > 0 ? `${e.roi.toFixed(0)}%` : "—"} />
                    </div>

                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  <button
                    onClick={() => { setResultsFor(c); setResults(campaignIntel(c.id)); }}
                    className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
                  >
                    <BarChart3 className="mr-1 inline h-3.5 w-3.5" /> Record results
                  </button>
                  <button onClick={() => openEdit(c)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/20"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("Delete campaign?")) del.mutate(c.id); }} className="grid h-9 w-9 place-items-center rounded-lg bg-red-500/20 hover:bg-red-500/30"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {tab === "channels" && (
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="h-5 w-5 text-amber-300" />
            <h2 className="font-display text-lg font-bold">Channel performance</h2>
            <a href="/m/crm/channels" className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Manage channels</a>
          </div>
          {channelPerf.length === 0 ? (
            <p className="mt-4 text-sm text-white/55">No channel activity yet. Add channels and run a campaign to compare which channels produce the best customers.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/50">
                    <th className="pb-2">Channel</th><th className="pb-2">Campaigns</th><th className="pb-2">Customers</th>
                    <th className="pb-2">Leads</th><th className="pb-2">Acquired</th><th className="pb-2">CAC</th>
                    <th className="pb-2">Revenue</th><th className="pb-2">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {channelPerf.map((r) => (
                    <tr key={r.channel}>
                      <td className="py-2.5 capitalize text-white">{r.channel.replace(/_/g, " ")}</td>
                      <td className="py-2.5 text-white/70">{r.campaigns}</td>
                      <td className="py-2.5 text-white/70">{r.customers}</td>
                      <td className="py-2.5 text-white/70">{r.leads}</td>
                      <td className="py-2.5 text-white/70">{r.acquired}</td>
                      <td className="py-2.5 text-white/70">{r.acquired > 0 ? money(r.cost / r.acquired) : "—"}</td>
                      <td className="py-2.5 text-white/70">{money(r.revenue)}</td>
                      <td className="py-2.5 text-white/70">{r.cost > 0 ? `${(r.revenue / r.cost).toFixed(2)}x` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {tab === "activities" && (
        <div className="space-y-4">
          <GlassCard className="p-5"><h2 className="font-display text-lg font-bold">Record marketing activity</h2><div className="mt-4 grid gap-3 md:grid-cols-3">
            {(["activity_date", "activity_type", "channel", "quantity", "cost", "owner_name", "result", "notes"] as const).map((key) => <label key={key} className="text-xs text-white/60">{key.replace(/_/g, " ")}<input type={key === "activity_date" ? "date" : key === "quantity" || key === "cost" ? "number" : "text"} value={String(activityForm[key])} onChange={(e) => setActivityForm({ ...activityForm, [key]: key === "quantity" || key === "cost" ? Number(e.target.value) : e.target.value })} className={inputCls} /></label>)}
            <label className="text-xs text-white/60">Campaign<select value={activityForm.campaign_id} onChange={(e) => setActivityForm({ ...activityForm, campaign_id: e.target.value })} className={inputCls}><option value="">No campaign</option>{(campaigns as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </div><button onClick={() => saveActivity.mutate()} className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black">Save activity</button></GlassCard>
          {activities.length === 0 ? <TaxEmptyState icon={LayoutTemplate} title="No activities recorded" description="Track content, advertising, print and outreach activity against campaigns." /> : <div className="space-y-2">{(activities as any[]).map((activity) => <GlassCard key={activity.id} className="p-4"><div className="flex justify-between"><span className="font-semibold">{activity.activity_type}</span><span className="text-xs text-white/50">{activity.activity_date}</span></div><p className="mt-1 text-xs text-white/60">{activity.channel || "No channel"} · {activity.quantity} units · {money(activity.cost)}{activity.marketing_campaigns?.name ? ` · ${activity.marketing_campaigns.name}` : ""}</p>{activity.result && <p className="mt-2 text-sm text-white/70">{activity.result}</p>}</GlassCard>)}</div>}
        </div>
      )}

      {tab === "reach" && (
        <div className="space-y-4"><GlassCard className="p-5"><h2 className="font-display text-lg font-bold">Monthly customer reach</h2><div className="mt-4 grid gap-3 md:grid-cols-3">
          {(["period", "channel", "reached", "contacted", "leads", "converted", "notes"] as const).map((key) => <label key={key} className="text-xs text-white/60">{key.replace(/_/g, " ")}<input type={key === "period" ? "month" : ["reached", "contacted", "leads", "converted"].includes(key) ? "number" : "text"} value={String(reachForm[key])} onChange={(e) => setReachForm({ ...reachForm, [key]: ["reached", "contacted", "leads", "converted"].includes(key) ? Number(e.target.value) : e.target.value })} className={inputCls} /></label>)}
          <label className="text-xs text-white/60">Campaign<select value={reachForm.campaign_id} onChange={(e) => setReachForm({ ...reachForm, campaign_id: e.target.value })} className={inputCls}><option value="">No campaign</option>{(campaigns as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div><button onClick={() => saveReach.mutate()} className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black">Save reach</button></GlassCard>
          {reachRows.length === 0 ? <TaxEmptyState icon={Users} title="No reach recorded" description="Record monthly reach, contacts, leads and conversions for each channel." /> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-xs uppercase text-white/50"><th>Month</th><th>Channel</th><th>Reached</th><th>Contacted</th><th>Leads</th><th>Converted</th></tr></thead><tbody className="divide-y divide-white/10">{(reachRows as any[]).map((row) => <tr key={row.id}><td className="py-2">{row.period}</td><td className="py-2">{row.channel}</td><td className="py-2">{row.reached}</td><td className="py-2">{row.contacted}</td><td className="py-2">{row.leads}</td><td className="py-2">{row.converted}</td></tr>)}</tbody></table></div>}
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          {["Content Creation", "Sponsored Ads", "Customer Growth"].map((group) => (
            <GlassCard key={group} className="p-5">
              <h2 className="font-display text-base font-bold">{group}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPAIGN_TEMPLATES.filter((t) => t.group === group).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => useTemplate(t.key)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold text-white">{t.label}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-amber-300/80">{t.objective.replace(/_/g, " ")} · {t.channel}</p>
                    <p className="mt-1.5 text-xs text-white/55">{t.content}</p>
                  </button>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Sharing plan</h2>
            <button
              onClick={() => { setPlanForm({ id: undefined, campaignId: (campaigns as any[])[0]?.id ?? "", content: "", channel: "social", audience: "", publishDate: "", publishTime: "", owner: "", status: "planned" }); setPlanOpen(true); }}
              className="flex items-center gap-1.5 rounded-2xl border border-amber-300/40 bg-amber-400/20 px-3.5 py-2 text-xs font-semibold hover:bg-amber-400/30"
            >
              <Plus className="h-3.5 w-3.5" /> Schedule content
            </button>
          </div>
          {sharePlan.length === 0 ? (
            <TaxEmptyState
              icon={CalendarClock}
              title="Nothing scheduled"
              description="Plan which content goes to which channel, when, and who is responsible. Publishing results feed campaign performance."
            />
          ) : (
            <div className="space-y-2">
              {[...sharePlan].sort((a, b) => (a.publishDate || "9999").localeCompare(b.publishDate || "9999")).map((s) => {
                const campaign = (campaigns as any[]).find((c) => c.id === s.campaignId);
                return (
                  <GlassCard key={s.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.content || "Untitled content"}</p>
                      <p className="mt-1 text-xs text-white/60">
                        {campaign?.name ?? "No campaign"} · {s.channel} · {s.audience || "all audiences"}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        {s.publishDate ? `${s.publishDate} ${s.publishTime}` : "Unscheduled"} · {s.owner || "Unassigned"}
                      </p>
                    </div>
                    <StatusBadge value={s.status} />
                    <button
                      onClick={() => setPlanForm({ ...s, id: s.id, status: s.status as any })}
                      className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeSharePlanItem(s.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-red-500/20 hover:bg-red-500/30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* campaign create / edit */}
      <TopDrawer
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? "Edit Campaign" : "New Campaign"}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm">Cancel</button>
            <button disabled={save.isPending} onClick={() => save.mutate()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50">Save</button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Campaign Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Objective">
            <select value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value as CampaignObjective })} className={inputCls}>
              {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Target audience">
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputCls}>
              <option value="">All audiences</option>
              {audiences.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Customer segment">
            <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className={inputCls}>
              {["", "leads", "prospects", "new", "active", "repeat", "high_value", "inactive", "at_risk", "lost"].map((s) => (
                <option key={s || "all"} value={s}>{s ? s.replace(/_/g, " ") : "All customers"}</option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={inputCls}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Budget (TZS)"><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              {STATUSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Expected customers"><input type="number" value={form.expectedCustomers} onChange={(e) => setForm({ ...form, expectedCustomers: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Start"><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} /></Field>
          <Field label="End"><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} /></Field>
          <div className="md:col-span-2">
            <Field label="Content"><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className={inputCls + " min-h-20"} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls + " min-h-20"} /></Field>
          </div>
        </div>
      </TopDrawer>

      {/* campaign results */}
      <TopDrawer
        open={!!resultsFor}
        onClose={() => { setResultsFor(null); setResults(null); }}
        title={resultsFor ? `${resultsFor.name} — Results` : "Results"}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setResultsFor(null)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={() => { if (results) { saveCampaignIntel(results); toast.success("Results saved"); } setResultsFor(null); }}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              Save
            </button>
          </div>
        }
      >
        {results ? (
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ["impressions", "Impressions"], ["reach", "Reach"], ["engagement", "Engagement"], ["clicks", "Clicks"],
              ["leads", "Leads generated"], ["customersAcquired", "Customers acquired"], ["revenue", "Revenue (TZS)"], ["extraCost", "Extra cost (TZS)"],
            ] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  value={results[key]}
                  onChange={(e) => setResults({ ...results, [key]: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            ))}
            {resultsFor ? (
              <div className="md:col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(() => {
                  const e = campaignEconomics(Number(resultsFor.budget || 0), results, campaignAttribution(resultsFor.id));
                  return (
                    <>
                      <Mini label="CPL" value={e.cpl > 0 ? money(e.cpl) : "—"} />
                      <Mini label="CAC" value={e.cac > 0 ? money(e.cac) : "—"} />
                      <Mini label="ROI" value={e.cost > 0 ? `${e.roi.toFixed(0)}%` : "—"} />
                      <Mini label="ROAS" value={e.cost > 0 ? `${e.roas.toFixed(2)}x` : "—"} />
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        ) : null}
      </TopDrawer>

      {/* sharing plan item */}
      <TopDrawer
        open={planOpen || !!planForm.id}
        onClose={() => { setPlanOpen(false); setPlanForm({ ...planForm, id: undefined }); }}
        title={planForm.id ? "Edit scheduled content" : "Schedule content"}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => { setPlanOpen(false); setPlanForm({ ...planForm, id: undefined }); }} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={() => {
                saveSharePlanItem(planForm);
                toast.success("Sharing plan updated");
                setPlanOpen(false); setPlanForm({ ...planForm, id: undefined });
              }}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              Save
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Content"><input value={planForm.content} onChange={(e) => setPlanForm({ ...planForm, content: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="Campaign">
            <select value={planForm.campaignId} onChange={(e) => setPlanForm({ ...planForm, campaignId: e.target.value })} className={inputCls}>
              <option value="">No campaign</option>
              {(campaigns as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Channel">
            <select value={planForm.channel} onChange={(e) => setPlanForm({ ...planForm, channel: e.target.value })} className={inputCls}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Target audience">
            <select value={planForm.audience} onChange={(e) => setPlanForm({ ...planForm, audience: e.target.value })} className={inputCls}>
              <option value="">All audiences</option>
              {audiences.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Responsible person / team"><input value={planForm.owner} onChange={(e) => setPlanForm({ ...planForm, owner: e.target.value })} className={inputCls} /></Field>
          <Field label="Publish date"><input type="date" value={planForm.publishDate} onChange={(e) => setPlanForm({ ...planForm, publishDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Publish time"><input type="time" value={planForm.publishTime} onChange={(e) => setPlanForm({ ...planForm, publishTime: e.target.value })} className={inputCls} /></Field>
          <Field label="Status">
            <select value={planForm.status} onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as any })} className={inputCls}>
              {["planned", "scheduled", "published", "cancelled"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </TopDrawer>
    </CrmShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/60">{label}</p>
      <p className="mt-1 font-display text-sm font-bold">{value}</p>
    </div>
  );
}
