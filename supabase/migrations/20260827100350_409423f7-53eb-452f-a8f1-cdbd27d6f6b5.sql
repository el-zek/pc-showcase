-- ============================================================
-- ADDITIVE UPGRADE: expenses, customers, marketing intelligence
-- Nothing existing is dropped, renamed or altered destructively.
-- ============================================================

-- ---------- 1. EXPENSES: extend the existing tax_expenses register ----------
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS item text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS payee text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'one_time';
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS next_due_date date;
ALTER TABLE public.tax_expenses ADD COLUMN IF NOT EXISTS recurring_parent_id uuid REFERENCES public.tax_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tax_expenses_recurring_idx ON public.tax_expenses(user_id, is_recurring, next_due_date);
CREATE INDEX IF NOT EXISTS tax_expenses_campaign_idx ON public.tax_expenses(campaign_id);

-- ---------- 2. CUSTOMERS: extend the existing customers table ----------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'active';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS assigned_to_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS next_follow_up date;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS converted_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_lifecycle_idx ON public.customers(user_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS customers_follow_up_idx ON public.customers(user_id, next_follow_up);

-- ---------- 3. EXPENSE CATEGORIES (custom, on top of the built-in catalog) ----------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  parent_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expense categories" ON public.expense_categories
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_expense_categories_updated BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS expense_categories_user_idx ON public.expense_categories(user_id);

-- ---------- 4. CUSTOMER INTERACTIONS (follow-up log) ----------
CREATE TABLE IF NOT EXISTS public.customer_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  interaction_type text NOT NULL DEFAULT 'call',
  channel text,
  outcome text,
  notes text,
  next_follow_up date,
  staff_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interactions TO authenticated;
GRANT ALL ON public.customer_interactions TO service_role;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customer interactions" ON public.customer_interactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_customer_interactions_updated BEFORE UPDATE ON public.customer_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS customer_interactions_customer_idx ON public.customer_interactions(customer_id, occurred_at DESC);

-- ---------- 5. MARKETING ACTIVITIES (content, print, outreach) ----------
CREATE TABLE IF NOT EXISTS public.marketing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  activity_date date NOT NULL DEFAULT current_date,
  activity_group text NOT NULL DEFAULT 'content',
  activity_type text NOT NULL,
  channel text,
  quantity numeric NOT NULL DEFAULT 1,
  cost numeric NOT NULL DEFAULT 0,
  owner_name text,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES public.tax_expenses(id) ON DELETE SET NULL,
  result text,
  notes text,
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_activities TO authenticated;
GRANT ALL ON public.marketing_activities TO service_role;
ALTER TABLE public.marketing_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own marketing activities" ON public.marketing_activities
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_marketing_activities_updated BEFORE UPDATE ON public.marketing_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS marketing_activities_user_date_idx ON public.marketing_activities(user_id, activity_date DESC);

-- ---------- 6. MARKETING REACH (monthly reach per channel) ----------
CREATE TABLE IF NOT EXISTS public.marketing_reach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  period text NOT NULL,
  channel text NOT NULL,
  channel_id uuid REFERENCES public.customer_channels(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  reached integer NOT NULL DEFAULT 0,
  contacted integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  converted integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_reach TO authenticated;
GRANT ALL ON public.marketing_reach TO service_role;
ALTER TABLE public.marketing_reach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own marketing reach" ON public.marketing_reach
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_marketing_reach_updated BEFORE UPDATE ON public.marketing_reach
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS marketing_reach_user_period_idx ON public.marketing_reach(user_id, period);