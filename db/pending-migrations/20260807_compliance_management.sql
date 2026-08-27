-- =====================================================================
-- COMPLIANCE MANAGEMENT UPGRADE — MIGRATION PREPARED BUT **NOT EXECUTED**
-- ---------------------------------------------------------------------
-- Cloud/database deployment is not connected, so this file is kept OUT of
-- supabase/migrations on purpose. Nothing here has been applied and no
-- existing data is modified. All existing tax tables are reused as-is.
-- To deploy later: move this file into supabase/migrations/ with a fresh
-- timestamp prefix and apply it with the migration tool.
-- =====================================================================

-- ------------------------- business profile --------------------------
-- Extends the EXISTING profiles table (business registration) rather
-- than creating a second registration surface.
alter table public.profiles add column if not exists business_type text;
alter table public.profiles add column if not exists legal_form text;
alter table public.profiles add column if not exists sector text;
alter table public.profiles add column if not exists activities text[] default '{}';
alter table public.profiles add column if not exists region text;
alter table public.profiles add column if not exists size_category text;
alter table public.profiles add column if not exists annual_turnover numeric;
alter table public.profiles add column if not exists employee_count integer;
alter table public.profiles add column if not exists does_import boolean default false;
alter table public.profiles add column if not exists does_export boolean default false;
alter table public.profiles add column if not exists tax_registrations text[] default '{}';

-- --------------------- configurable rules catalogue ------------------
-- Official requirements are NOT hard-coded. A rule is authoritative only
-- once `configured` = true.
create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  category text not null,                 -- Tax|Licence|Permit|Filing|Payment|Registration|Other
  authority text,
  description text,
  basis text not null default 'profile',  -- profile|conditional|transaction
  conditions jsonb not null default '[]', -- [{field,operator,value}]
  frequency text not null default 'Periodic',
  requires_filing boolean not null default false,
  requires_payment boolean not null default false,
  requires_renewal boolean not null default false,
  requires_evidence boolean not null default false,
  due_rule jsonb,                         -- null => official due rule not configured
  configured boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.compliance_rules to authenticated;
grant all on public.compliance_rules to service_role;
alter table public.compliance_rules enable row level security;
create policy "own compliance rules" on public.compliance_rules
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------ compliance obligations ---------------------
-- Filing / payment / renewal / evidence are separate on purpose: an
-- obligation may require filing without payment, payment without
-- filing, or evidence only.
create table if not exists public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  rule_id uuid references public.compliance_rules(id) on delete set null,
  name text not null,
  category text not null,
  authority text,
  description text,
  applicability text not null default 'requires_review', -- applicable|requires_review|not_applicable
  registration_state text,                -- registered|not_registered|not_required
  frequency text,
  period text,                            -- null for non-periodic obligations
  due_date date,                           -- null when there is no deadline
  expiry_date date,                        -- null when nothing expires
  filing_required boolean not null default false,
  filing_status text,                      -- not_required|outstanding|filed
  payment_required boolean not null default false,
  amount_due numeric,
  payment_status text,                     -- not_required|unpaid|partial|paid
  evidence_required boolean not null default false,
  document_id uuid references public.tax_documents(id) on delete set null,
  reminder_on boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.compliance_obligations to authenticated;
grant all on public.compliance_obligations to service_role;
alter table public.compliance_obligations enable row level security;
create policy "own compliance obligations" on public.compliance_obligations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --------------------------- licences / permits ----------------------
create table if not exists public.compliance_licences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  obligation_id uuid references public.compliance_obligations(id) on delete set null,
  name text not null,
  licence_type text,                       -- Licence|Permit|Registration|Certificate
  authority text,
  reference text,
  issue_date date,
  expiry_date date,                        -- null for non-expiring items
  renewal_required boolean not null default false,
  renewal_frequency text,                  -- Annual|Periodic|One-time|Event-based|Non-renewable
  fee_amount numeric,
  payment_status text,
  status text not null default 'Active',
  document_id uuid references public.tax_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.compliance_licences to authenticated;
grant all on public.compliance_licences to service_role;
alter table public.compliance_licences enable row level security;
create policy "own compliance licences" on public.compliance_licences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------- evidence link (reuses tax_documents) ------------
-- Documents are not duplicated: tax_documents stays the single store.
create table if not exists public.compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  document_id uuid not null references public.tax_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (obligation_id, document_id)
);
grant select, insert, update, delete on public.compliance_evidence to authenticated;
grant all on public.compliance_evidence to service_role;
alter table public.compliance_evidence enable row level security;
create policy "own compliance evidence" on public.compliance_evidence
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- NOTE: no seed data. Official rates, thresholds, filing periods and
-- licence fees are intentionally absent and must be configured through
-- the in-app rules catalogue.
