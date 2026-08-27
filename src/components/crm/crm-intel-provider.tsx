import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * CRM market / campaign intelligence store.
 *
 * Intelligence is persisted in the existing market_audiences, campaign_results
 * and campaign_share_plan tables so it is shared across devices and sessions.
 */

export type MarketAudience = {
  id: string;
  name: string;
  region: string;
  /** estimated total potential customers in this audience */
  available: number;
  /** how many of those the business can realistically reach today */
  reach: number;
  channels: string[];
  notes?: string;
};

export type CampaignObjective =
  | "awareness"
  | "lead_generation"
  | "conversion"
  | "retention"
  | "reactivation"
  | "referral";

export type CampaignTemplateKey =
  | "content_educational"
  | "content_product_awareness"
  | "content_brand"
  | "content_demo"
  | "content_testimonial"
  | "ads_awareness"
  | "ads_leads"
  | "ads_conversion"
  | "ads_retargeting"
  | "growth_acquisition"
  | "growth_retention"
  | "growth_repeat"
  | "growth_referral"
  | "growth_reactivation";

export type CampaignTemplate = {
  key: CampaignTemplateKey;
  group: "Content Creation" | "Sponsored Ads" | "Customer Growth";
  label: string;
  objective: CampaignObjective;
  channel: string;
  content: string;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  { key: "content_educational", group: "Content Creation", label: "Educational content", objective: "awareness", channel: "social", content: "Teach the audience how to solve a problem your product addresses." },
  { key: "content_product_awareness", group: "Content Creation", label: "Product awareness", objective: "awareness", channel: "social", content: "Introduce a product, its use case and price positioning." },
  { key: "content_brand", group: "Content Creation", label: "Brand awareness", objective: "awareness", channel: "social", content: "Who we are, what we stand for, why customers trust us." },
  { key: "content_demo", group: "Content Creation", label: "Product demonstration", objective: "conversion", channel: "social", content: "Short demo showing the product in real use." },
  { key: "content_testimonial", group: "Content Creation", label: "Customer story / testimonial", objective: "conversion", channel: "social", content: "A served customer tells their result in their own words." },
  { key: "ads_awareness", group: "Sponsored Ads", label: "Awareness ads", objective: "awareness", channel: "social", content: "Paid reach to the unserved part of the reachable market." },
  { key: "ads_leads", group: "Sponsored Ads", label: "Lead generation ads", objective: "lead_generation", channel: "social", content: "Collect contacts of interested prospects." },
  { key: "ads_conversion", group: "Sponsored Ads", label: "Conversion ads", objective: "conversion", channel: "social", content: "Drive orders from warm audiences." },
  { key: "ads_retargeting", group: "Sponsored Ads", label: "Retargeting ads", objective: "conversion", channel: "social", content: "Re-engage people who interacted but did not buy." },
  { key: "growth_acquisition", group: "Customer Growth", label: "New customer acquisition", objective: "lead_generation", channel: "whatsapp", content: "Offer designed to convert first-time customers." },
  { key: "growth_retention", group: "Customer Growth", label: "Customer retention", objective: "retention", channel: "sms", content: "Keep active customers buying — value reminders and care." },
  { key: "growth_repeat", group: "Customer Growth", label: "Repeat purchase", objective: "retention", channel: "sms", content: "Trigger the next order from customers who bought once." },
  { key: "growth_referral", group: "Customer Growth", label: "Referral", objective: "referral", channel: "whatsapp", content: "Ask happy customers to bring one more customer." },
  { key: "growth_reactivation", group: "Customer Growth", label: "Reactivation", objective: "reactivation", channel: "sms", content: "Win back customers who went inactive." },
];

export type CampaignIntel = {
  campaignId: string;
  objective: CampaignObjective;
  template?: CampaignTemplateKey;
  audience?: string;
  segment?: string;
  content?: string;
  expectedCustomers?: number;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  leads: number;
  customersAcquired: number;
  revenue: number;
  extraCost: number;
};

export type SharePlanItem = {
  id: string;
  campaignId: string;
  content: string;
  channel: string;
  audience: string;
  publishDate: string;
  publishTime: string;
  owner: string;
  status: "planned" | "scheduled" | "published" | "cancelled";
};

/**
 * Real acquisition attribution for a campaign, derived from
 * customers.acquired_campaign_id joined to that customer's completed sales.
 * Nothing here is estimated — a sale only counts once, for the campaign that
 * acquired its customer.
 */
export type CampaignAttribution = {
  campaignId: string;
  /** customers whose acquired_campaign_id is this campaign */
  acquiredCustomers: number;
  /** of those, how many have at least one completed sale */
  convertedCustomers: number;
  orders: number;
  revenue: number;
};

export const emptyAttribution = (campaignId: string): CampaignAttribution => ({
  campaignId,
  acquiredCustomers: 0,
  convertedCustomers: 0,
  orders: 0,
  revenue: 0,
});

type State = {
  audiences: MarketAudience[];
  campaigns: CampaignIntel[];
  sharePlan: SharePlanItem[];
  attribution: CampaignAttribution[];
  /** revenue from completed sales with no campaign-acquired customer */
  unattributedRevenue: number;
};

const EMPTY: State = { audiences: [], campaigns: [], sharePlan: [], attribution: [], unattributedRevenue: 0 };


export const emptyCampaignIntel = (campaignId: string): CampaignIntel => ({
  campaignId,
  objective: "awareness",
  impressions: 0,
  reach: 0,
  engagement: 0,
  clicks: 0,
  leads: 0,
  customersAcquired: 0,
  revenue: 0,
  extraCost: 0,
});

type Ctx = {
  audiences: MarketAudience[];
  campaignIntel: (campaignId: string) => CampaignIntel;
  allCampaignIntel: CampaignIntel[];
  campaignAttribution: (campaignId: string) => CampaignAttribution;
  allAttribution: CampaignAttribution[];
  unattributedRevenue: number;
  sharePlan: SharePlanItem[];
  saveAudience: (row: Omit<MarketAudience, "id"> & { id?: string }) => void;
  removeAudience: (id: string) => void;
  saveCampaignIntel: (row: CampaignIntel) => void;
  saveSharePlanItem: (row: Omit<SharePlanItem, "id"> & { id?: string }) => void;
  removeSharePlanItem: (id: string) => void;
  market: { available: number; reach: number };
  refresh: () => Promise<void>;
};

const CrmIntelContext = createContext<Ctx | null>(null);

export function CrmIntelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);

  const refresh = useCallback(async () => {
    const [audiences, campaigns, sharePlan, customers, sales] = await Promise.all([
      supabase.from("market_audiences").select("*").order("created_at", { ascending: false }),
      supabase.from("campaign_results").select("*"),
      supabase.from("campaign_share_plan").select("*, market_audiences(name)").order("publish_date"),
      supabase.from("customers").select("id,acquired_campaign_id"),
      supabase.from("sales").select("id,customer_id,total,status").eq("status", "completed"),
    ]);
    const audienceRows = audiences.data ?? [];

    // Attribution: a completed sale belongs to the campaign that acquired its
    // customer. Sales without such a customer stay unattributed.
    const campaignByCustomer = new Map<string, string>();
    const attribution = new Map<string, CampaignAttribution>();
    for (const row of (customers.data ?? []) as any[]) {
      if (!row.acquired_campaign_id) continue;
      campaignByCustomer.set(row.id, row.acquired_campaign_id);
      const entry = attribution.get(row.acquired_campaign_id) ?? emptyAttribution(row.acquired_campaign_id);
      entry.acquiredCustomers += 1;
      attribution.set(row.acquired_campaign_id, entry);
    }
    const convertedSeen = new Set<string>();
    let unattributedRevenue = 0;
    for (const sale of (sales.data ?? []) as any[]) {
      const campaignId = sale.customer_id ? campaignByCustomer.get(sale.customer_id) : undefined;
      const total = Number(sale.total || 0);
      if (!campaignId) {
        unattributedRevenue += total;
        continue;
      }
      const entry = attribution.get(campaignId) ?? emptyAttribution(campaignId);
      entry.orders += 1;
      entry.revenue += total;
      const key = `${campaignId}:${sale.customer_id}`;
      if (!convertedSeen.has(key)) {
        convertedSeen.add(key);
        entry.convertedCustomers += 1;
      }
      attribution.set(campaignId, entry);
    }

    setState({
      audiences: audienceRows.map((row: any) => ({
        id: row.id, name: row.name, region: row.region ?? "", available: Number(row.available_customers ?? 0),
        reach: Number(row.reach_customers ?? 0), channels: row.channels ?? [], notes: row.notes ?? "",
      })),
      campaigns: (campaigns.data ?? []).map((row: any) => ({
        campaignId: row.campaign_id, objective: "awareness", impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0), engagement: Number(row.engagement ?? 0), clicks: Number(row.clicks ?? 0),
        leads: Number(row.leads ?? 0), customersAcquired: Number(row.customers_acquired ?? 0),
        revenue: Number(row.revenue ?? 0), extraCost: Number(row.extra_cost ?? 0),
      })),
      sharePlan: (sharePlan.data ?? []).map((row: any) => ({
        id: row.id, campaignId: row.campaign_id ?? "", content: row.content, channel: row.channel ?? "",
        audience: row.market_audiences?.name ?? "", publishDate: row.publish_date ?? "", publishTime: row.publish_time ?? "",
        owner: row.owner ?? "", status: row.status,
      })),
      attribution: Array.from(attribution.values()),
      unattributedRevenue,
    });
  }, []);


  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<Ctx>(() => {
    return {
      audiences: state.audiences,
      allCampaignIntel: state.campaigns,
      allAttribution: state.attribution,
      unattributedRevenue: state.unattributedRevenue,
      campaignAttribution: (campaignId) =>
        state.attribution.find((a) => a.campaignId === campaignId) ?? emptyAttribution(campaignId),
      refresh,
      sharePlan: state.sharePlan,
      campaignIntel: (campaignId) =>
        state.campaigns.find((c) => c.campaignId === campaignId) ?? emptyCampaignIntel(campaignId),

      saveAudience: (row) => {
        void (async () => {
          const payload = {
            name: row.name, region: row.region || null, available_customers: row.available,
            reach_customers: row.reach, channels: row.channels, notes: row.notes || null,
          };
          if (row.id) await supabase.from("market_audiences").update(payload).eq("id", row.id);
          else await supabase.from("market_audiences").insert(payload);
          await refresh();
        })();
      },
      removeAudience: (id) => { void (async () => { await supabase.from("market_audiences").delete().eq("id", id); await refresh(); })(); },
      saveCampaignIntel: (row) => {
        void (async () => {
          await supabase.from("campaign_results").upsert({
            campaign_id: row.campaignId, impressions: row.impressions, reach: row.reach, engagement: row.engagement,
            clicks: row.clicks, leads: row.leads, customers_acquired: row.customersAcquired,
            revenue: row.revenue, extra_cost: row.extraCost,
          }, { onConflict: "campaign_id" });
          await refresh();
        })();
      },
      saveSharePlanItem: (row) => {
        void (async () => {
          const audienceId = state.audiences.find((audience) => audience.name === row.audience)?.id ?? null;
          const payload = {
            campaign_id: row.campaignId || null, content: row.content, channel: row.channel || null,
            audience_id: audienceId, publish_date: row.publishDate || null, publish_time: row.publishTime || null,
            owner: row.owner || null, status: row.status,
          };
          if (row.id) await supabase.from("campaign_share_plan").update(payload).eq("id", row.id);
          else await supabase.from("campaign_share_plan").insert(payload);
          await refresh();
        })();
      },
      removeSharePlanItem: (id) => { void (async () => { await supabase.from("campaign_share_plan").delete().eq("id", id); await refresh(); })(); },
      market: {
        available: state.audiences.reduce((a, x) => a + Number(x.available || 0), 0),
        reach: state.audiences.reduce((a, x) => a + Number(x.reach || 0), 0),
      },
    };
  }, [state, refresh]);

  return <CrmIntelContext.Provider value={value}>{children}</CrmIntelContext.Provider>;
}

export function useCrmIntel() {
  const ctx = useContext(CrmIntelContext);
  if (!ctx) throw new Error("useCrmIntel must be used inside CrmIntelProvider");
  return ctx;
}

/* ------------------------------- derivations ------------------------------- */

export type MarketPosition = {
  available: number;
  reach: number;
  served: number;
  unservedReach: number;
  unservedAvailable: number;
  penetration: number;
  reachCoverage: number;
  reachConversion: number;
};

export function marketPosition(available: number, reach: number, served: number): MarketPosition {
  return {
    available,
    reach,
    served,
    unservedReach: Math.max(reach - served, 0),
    unservedAvailable: Math.max(available - served, 0),
    penetration: available > 0 ? (served / available) * 100 : 0,
    reachCoverage: available > 0 ? (reach / available) * 100 : 0,
    reachConversion: reach > 0 ? (served / reach) * 100 : 0,
  };
}

export type CampaignEconomics = {
  cost: number;
  leads: number;
  acquired: number;
  /** revenue used for ROI: real attributed sales when they exist, else manually reported */
  revenue: number;
  /** completed sales of customers acquired by this campaign */
  attributedRevenue: number;
  /** revenue typed into campaign results by the user */
  reportedRevenue: number;
  attributedOrders: number;
  cpl: number;
  cac: number;
  conversion: number;
  roi: number;
  roas: number;
  engagementRate: number;
  ctr: number;
};

export function campaignEconomics(
  budget: number,
  intel: CampaignIntel,
  attribution?: CampaignAttribution,
): CampaignEconomics {
  const cost = Number(budget || 0) + Number(intel.extraCost || 0);
  const leads = Number(intel.leads || 0);
  const attributedRevenue = Number(attribution?.revenue ?? 0);
  const reportedRevenue = Number(intel.revenue || 0);
  // Real acquisitions win over the manually reported number so ROI never
  // double-counts the same customers.
  const acquired = attribution && attribution.acquiredCustomers > 0
    ? attribution.acquiredCustomers
    : Number(intel.customersAcquired || 0);
  const revenue = attributedRevenue > 0 ? attributedRevenue : reportedRevenue;
  return {
    cost,
    leads,
    acquired,
    revenue,
    attributedRevenue,
    reportedRevenue,
    attributedOrders: Number(attribution?.orders ?? 0),
    cpl: leads > 0 ? cost / leads : 0,
    cac: acquired > 0 ? cost / acquired : 0,
    conversion: leads > 0 ? (acquired / leads) * 100 : 0,
    roi: cost > 0 ? ((revenue - cost) / cost) * 100 : 0,
    roas: cost > 0 ? revenue / cost : 0,
    engagementRate: intel.reach > 0 ? (intel.engagement / intel.reach) * 100 : 0,
    ctr: intel.impressions > 0 ? (intel.clicks / intel.impressions) * 100 : 0,

  };
}

export type OpportunityLevel = "High" | "Medium" | "Low" | "Not enough data";

/**
 * Investment signal: combines remaining market, conversion quality and unit
 * economics (customer value vs acquisition cost).
 */
export function opportunityLevel(input: {
  unservedReach: number;
  conversion: number;
  cac: number;
  customerValue: number;
}): { level: OpportunityLevel; reason: string } {
  const { unservedReach, conversion, cac, customerValue } = input;
  if (unservedReach <= 0) return { level: "Low", reason: "No unserved reachable market left — expand reach or audience first." };
  if (cac <= 0 || customerValue <= 0) {
    return { level: "Not enough data", reason: "Record campaign cost, acquisitions and revenue to score this opportunity." };
  }
  const ratio = customerValue / cac;
  if (ratio >= 3 && conversion >= 15) {
    return { level: "High", reason: "Large unserved reach, strong conversion and customer value well above acquisition cost." };
  }
  if (ratio >= 1.5) {
    return { level: "Medium", reason: "Market potential is there but conversion or unit economics are only moderate." };
  }
  return { level: "Low", reason: "Acquisition cost is close to or above customer value — fix economics before investing more." };
}

export const OBJECTIVES: { value: CampaignObjective; label: string }[] = [
  { value: "awareness", label: "Awareness" },
  { value: "lead_generation", label: "Lead generation" },
  { value: "conversion", label: "Conversion" },
  { value: "retention", label: "Retention" },
  { value: "reactivation", label: "Reactivation" },
  { value: "referral", label: "Referral" },
];
