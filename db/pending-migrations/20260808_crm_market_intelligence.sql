-- =====================================================================
-- CRM MARKET & CAMPAIGN INTELLIGENCE — MIGRATION PREPARED BUT **NOT EXECUTED**
-- ---------------------------------------------------------------------
-- No cloud/database execution environment is available for this task, so
-- this file is deliberately kept OUT of supabase/migrations. Nothing here
-- has been applied. Until it is applied, the new market/campaign
-- intelligence layer persists locally (same convention as HR & Compliance).
-- To deploy later: move into supabase/migrations/ with a fresh timestamp.
-- =====================================================================

-- ------------------------------ audiences -----------------------------
-- Market model: customers available -> reach market -> customers served.
create table if not exists public.market_audiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  region text,
  available_customers integer not null default 0 check (available_customers >= 0),
  reach_customers integer not null default 0 check (reach_customers >= 0),
  channels text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_audiences_reach_within_available check (reach_customers <= available_customers)
);
create index if not exists market_audiences_user_idx on public.market_audiences(user_id);

grant select, insert, update, delete on public.market_audiences to authenticated;
grant all on public.market_audiences to service_role;
alter table public.market_audiences enable row level security;
create policy "own audiences" on public.market_audiences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------- campaign extension -----------------------
alter table public.marketing_campaigns add column if not exists objective text;
alter table public.marketing_campaigns add column if not exists template_key text;
alter table public.marketing_campaigns add column if not exists audience_id uuid references public.market_audiences(id) on delete set null;
alter table public.marketing_campaigns add column if not exists segment text;
alter table public.marketing_campaigns add column if not exists content text;
alter table public.marketing_campaigns add column if not exists expected_customers integer default 0;

-- --------------------------- campaign results -------------------------
create table if not exists public.campaign_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  impressions integer not null default 0,
  reach integer not null default 0,
  engagement integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  customers_acquired integer not null default 0,
  revenue numeric not null default 0,
  extra_cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id)
);
create index if not exists campaign_results_campaign_idx on public.campaign_results(campaign_id);

grant select, insert, update, delete on public.campaign_results to authenticated;
grant all on public.campaign_results to service_role;
alter table public.campaign_results enable row level security;
create policy "own campaign results" on public.campaign_results
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------- sharing / distribution -------------------
create table if not exists public.campaign_share_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  channel_id uuid references public.customer_channels(id) on delete set null,
  channel text,
  content text not null,
  audience_id uuid references public.market_audiences(id) on delete set null,
  publish_date date,
  publish_time time,
  owner text,
  status text not null default 'planned'
    check (status in ('planned','scheduled','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaign_share_plan_campaign_idx on public.campaign_share_plan(campaign_id);
create index if not exists campaign_share_plan_date_idx on public.campaign_share_plan(publish_date);

grant select, insert, update, delete on public.campaign_share_plan to authenticated;
grant all on public.campaign_share_plan to service_role;
alter table public.campaign_share_plan enable row level security;
create policy "own share plan" on public.campaign_share_plan
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------ customers -----------------------------
-- Segmentation / acquisition attribution on the EXISTING customers table.
alter table public.customers add column if not exists segment text;
alter table public.customers add column if not exists source text;
alter table public.customers add column if not exists audience_id uuid references public.market_audiences(id) on delete set null;
alter table public.customers add column if not exists acquired_campaign_id uuid references public.marketing_campaigns(id) on delete set null;
alter table public.customers add column if not exists first_interaction_at timestamptz;
alter table public.customers add column if not exists first_purchase_at timestamptz;
alter table public.customers add column if not exists last_activity_at timestamptz;
create index if not exists customers_segment_idx on public.customers(segment);
create index if not exists customers_campaign_idx on public.customers(acquired_campaign_id);
