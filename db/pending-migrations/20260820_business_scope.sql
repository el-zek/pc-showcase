-- =====================================================================
-- Business-Aware Module & Feature Scope — OPTIONAL hardening migration
-- ---------------------------------------------------------------------
-- NOT EXECUTED. Provided for review only.
--
-- The scope layer shipped in the application works today WITHOUT this
-- migration: business characteristics and the subscription plan are stored
-- in the existing `business_settings` key/value table under the keys
--   business.characteristics  (JSON, see src/lib/business-scope.ts)
--   business.plan             ('full' | 'standard' | 'starter')
-- and the capability rules live in code (src/lib/business-scope.ts).
--
-- This file describes the durable, server-enforced version of the same
-- model for when migrations are allowed. It introduces NO changes to
-- existing tables, roles, permissions or RLS behaviour.
-- =====================================================================

-- 1. Explicit business characteristics (one row per business).
create table if not exists public.business_characteristics (
  business_id uuid primary key,                     -- FK target once a businesses table exists
  legal_form text,
  business_type text,
  sector text,
  employee_count integer,
  tax_registrations text[] not null default '{}',
  does_import boolean not null default false,
  does_export boolean not null default false,
  flags jsonb not null default '{}'::jsonb,         -- operational flags (sells_products, uses_pos, ...)
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.business_characteristics to authenticated;
grant all on public.business_characteristics to service_role;
alter table public.business_characteristics enable row level security;

-- Reads/writes are limited to the caller's own business context.
create policy "own business characteristics"
  on public.business_characteristics
  for all
  to authenticated
  using (business_id = auth.uid())
  with check (business_id = auth.uid());

-- 2. Subscription entitlement (kept separate from eligibility on purpose).
create table if not exists public.business_subscription (
  business_id uuid primary key,
  plan text not null default 'full',
  status text not null default 'active',            -- active | trialing | past_due | cancelled
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

grant select on public.business_subscription to authenticated;
grant all on public.business_subscription to service_role;
alter table public.business_subscription enable row level security;

create policy "own subscription readable"
  on public.business_subscription
  for select
  to authenticated
  using (business_id = auth.uid());

-- 3. Server-side capability check, mirroring src/lib/business-scope.ts.
--    Backend writes can then require: has_capability(auth.uid(), 'payroll').
create or replace function public.has_capability(_business_id uuid, _capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.business_characteristics;
  s public.business_subscription;
  eligible boolean := true;
  entitled boolean := true;
begin
  select * into c from public.business_characteristics where business_id = _business_id;

  -- Legacy business with no configuration keeps the full platform.
  if c.business_id is null then
    return true;
  end if;

  eligible := case _capability
    when 'inventory'        then coalesce((c.flags->>'uses_inventory')::boolean, true)
    when 'products'         then coalesce((c.flags->>'sells_products')::boolean, true)
    when 'pos'              then coalesce((c.flags->>'uses_pos')::boolean, true)
    when 'credit_sales'     then coalesce((c.flags->>'accepts_credit')::boolean, true)
    when 'purchasing'       then coalesce((c.flags->>'has_suppliers')::boolean, true)
    when 'suppliers'        then coalesce((c.flags->>'has_suppliers')::boolean, true)
    when 'customers'        then coalesce((c.flags->>'has_customers')::boolean, true)
    when 'employees'        then coalesce((c.flags->>'has_employees')::boolean, coalesce(c.employee_count, 0) > 0)
    when 'payroll'          then coalesce((c.flags->>'runs_payroll')::boolean, true)
                                 and coalesce((c.flags->>'has_employees')::boolean, coalesce(c.employee_count, 0) > 0)
    when 'multi_warehouse'  then coalesce((c.flags->>'multi_location')::boolean, false)
    when 'stock_transfers'  then coalesce((c.flags->>'multi_location')::boolean, false)
    when 'tax_vat'          then 'VAT' = any (c.tax_registrations)
    when 'tax_import_export' then c.does_import or c.does_export
    else true
  end;

  select * into s from public.business_subscription where business_id = _business_id;
  if s.business_id is not null then
    entitled := s.status in ('active', 'trialing')
      and (s.expires_at is null or s.expires_at > now())
      and (
        s.plan = 'full'
        or (s.plan = 'standard' and _capability not in ('advanced_analytics', 'multi_warehouse', 'stock_transfers'))
        or (s.plan = 'starter' and _capability in (
              'sales','pos','products','inventory','customers','finance','expenses',
              'tax','compliance','reports','administration'))
      );
  end if;

  return eligible and entitled;
end;
$$;

-- 4. Example of how a write path would consume it (NOT applied):
-- alter table public.paye_records enable row level security;
-- create policy "payroll writes require the payroll capability"
--   on public.paye_records for insert to authenticated
--   with check (public.has_capability(auth.uid(), 'payroll'));
