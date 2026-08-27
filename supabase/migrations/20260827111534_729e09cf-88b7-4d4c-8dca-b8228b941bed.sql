CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','manager','cashier','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  business_name text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  business_type text,
  legal_form text,
  sector text,
  activities text[] NOT NULL DEFAULT '{}',
  region text,
  size_category text,
  annual_turnover numeric,
  employee_count integer,
  does_import boolean NOT NULL DEFAULT false,
  does_export boolean NOT NULL DEFAULT false,
  tax_registrations text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.customer_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'digital',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.market_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  region text,
  available_customers integer NOT NULL DEFAULT 0 CHECK (available_customers >= 0),
  reach_customers integer NOT NULL DEFAULT 0 CHECK (reach_customers >= 0),
  channels text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_audiences_reach_within_available CHECK (reach_customers <= available_customers)
);

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  budget numeric NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'sms',
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  objective text,
  template_key text,
  audience_id uuid REFERENCES public.market_audiences(id) ON DELETE SET NULL,
  segment text,
  content text,
  expected_customers integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  phone text,
  location text,
  address text,
  customer_type text NOT NULL DEFAULT 'retail',
  status text NOT NULL DEFAULT 'active',
  channel_id uuid REFERENCES public.customer_channels(id) ON DELETE SET NULL,
  segment text,
  source text,
  audience_id uuid REFERENCES public.market_audiences(id) ON DELETE SET NULL,
  acquired_campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  first_interaction_at timestamptz,
  first_purchase_at timestamptz,
  last_activity_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_segment_idx ON public.customers(segment);
CREATE INDEX customers_campaign_idx ON public.customers(acquired_campaign_id);

CREATE TABLE public.campaign_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  impressions integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  engagement integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  customers_acquired integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  extra_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id)
);

CREATE TABLE public.campaign_share_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.customer_channels(id) ON DELETE SET NULL,
  channel text,
  content text NOT NULL,
  audience_id uuid REFERENCES public.market_audiences(id) ON DELETE SET NULL,
  publish_date date,
  publish_time time,
  owner text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','scheduled','published','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  phone text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  location text,
  manager text,
  capacity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  sku text,
  barcode text,
  category text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  description text,
  image_path text,
  selling_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 18,
  stock_quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  invoice_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed',
  sale_date date NOT NULL DEFAULT current_date,
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  description text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT current_date,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  role text,
  department text,
  phone text,
  salary numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  hired_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  purchase_no text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL DEFAULT '',
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT current_date,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  purchase_id uuid NOT NULL REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  from_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  from_warehouse text NOT NULL DEFAULT '',
  to_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  notes text,
  transfer_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  reference text,
  notes text,
  movement_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  reference text NOT NULL,
  customer text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  vat numeric NOT NULL DEFAULT 0,
  tax_period text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  supplier text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  deductible boolean NOT NULL DEFAULT true,
  category text,
  attachment boolean NOT NULL DEFAULT false,
  tax_period text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  description text NOT NULL,
  category text,
  date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  deductible boolean NOT NULL DEFAULT true,
  receipt boolean NOT NULL DEFAULT false,
  tax_period text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vat_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  period text NOT NULL,
  output_vat numeric NOT NULL DEFAULT 0,
  input_vat numeric NOT NULL DEFAULT 0,
  payable numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_status text NOT NULL DEFAULT 'Unpaid',
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.withholding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  certificate text,
  type text,
  date date NOT NULL DEFAULT current_date,
  period text NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'Unpaid',
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.paye_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  period text NOT NULL,
  employees integer NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  paye_amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_status text NOT NULL DEFAULT 'Unpaid',
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.income_tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  period text NOT NULL,
  installment text,
  profit_base numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 30,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_status text NOT NULL DEFAULT 'Unpaid',
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.capital_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  category text,
  purchase_date date NOT NULL DEFAULT current_date,
  purchase_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  depreciation numeric NOT NULL DEFAULT 0,
  useful_life integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  category text,
  type text,
  size text,
  status text NOT NULL DEFAULT 'Pending',
  uploaded_at date NOT NULL DEFAULT current_date,
  file_path text,
  file_url text,
  file_size bigint,
  sale_id uuid REFERENCES public.tax_sales(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_documents_sale_id ON public.tax_documents(sale_id);

CREATE TABLE public.tax_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  type text,
  rows_count integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Completed',
  imported_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  tax_rate numeric NOT NULL DEFAULT 30,
  projected_annual_profit numeric NOT NULL DEFAULT 0,
  reminders_off text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  quote_no text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  quote_date date NOT NULL DEFAULT current_date,
  valid_until date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  order_no text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  order_date date NOT NULL DEFAULT current_date,
  delivery_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  return_no text NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  invoice_number text,
  customer_name text NOT NULL DEFAULT '',
  return_date date NOT NULL DEFAULT current_date,
  reason text,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  invoice_number text,
  customer_name text NOT NULL DEFAULT '',
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'Received',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'Bank',
  payment_method text NOT NULL DEFAULT 'Bank',
  account_number text,
  currency text NOT NULL DEFAULT 'TZS',
  opening_balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  payment_type text NOT NULL DEFAULT 'Manual Payment',
  payment_method text NOT NULL DEFAULT 'Cash',
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'out',
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT current_date,
  reference text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  invoice_number text,
  attachment_path text,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'Completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  from_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  from_account_name text NOT NULL DEFAULT '',
  to_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  to_account_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  transfer_date date NOT NULL DEFAULT current_date,
  reference text,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'Completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  name text NOT NULL,
  category text NOT NULL,
  authority text,
  description text,
  basis text NOT NULL DEFAULT 'profile',
  conditions jsonb NOT NULL DEFAULT '[]',
  frequency text NOT NULL DEFAULT 'Periodic',
  requires_filing boolean NOT NULL DEFAULT false,
  requires_payment boolean NOT NULL DEFAULT false,
  requires_renewal boolean NOT NULL DEFAULT false,
  requires_evidence boolean NOT NULL DEFAULT false,
  due_rule jsonb,
  configured boolean NOT NULL DEFAULT false,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  rule_id uuid REFERENCES public.compliance_rules(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL,
  authority text,
  description text,
  applicability text NOT NULL DEFAULT 'requires_review',
  registration_state text,
  frequency text,
  period text,
  due_date date,
  expiry_date date,
  filing_required boolean NOT NULL DEFAULT false,
  filing_status text,
  payment_required boolean NOT NULL DEFAULT false,
  amount_due numeric,
  payment_status text,
  evidence_required boolean NOT NULL DEFAULT false,
  document_id uuid REFERENCES public.tax_documents(id) ON DELETE SET NULL,
  reminder_on boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  obligation_id uuid REFERENCES public.compliance_obligations(id) ON DELETE SET NULL,
  name text NOT NULL,
  licence_type text,
  authority text,
  reference text,
  issue_date date,
  expiry_date date,
  renewal_required boolean NOT NULL DEFAULT false,
  renewal_frequency text,
  fee_amount numeric,
  payment_status text,
  status text NOT NULL DEFAULT 'Active',
  document_id uuid REFERENCES public.tax_documents(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  obligation_id uuid NOT NULL REFERENCES public.compliance_obligations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.tax_documents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obligation_id, document_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_channels','market_audiences','marketing_campaigns','customers','campaign_results',
    'campaign_share_plan','product_categories','suppliers','warehouses','products','sales','sale_items',
    'expenses','employees','inventory_purchases','inventory_purchase_items','stock_transfers',
    'stock_movements','tax_sales','tax_purchases','tax_expenses','vat_returns','withholding_records',
    'paye_records','income_tax_records','capital_assets','tax_documents','tax_imports','tax_settings',
    'quotations','quotation_items','sales_orders','sales_order_items','sales_returns','sales_return_items',
    'sales_payments','finance_accounts','finance_payments','finance_transfers','finance_audit_logs',
    'compliance_rules','compliance_obligations','compliance_licences','compliance_evidence'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    EXECUTE format('CREATE INDEX idx_%I_user ON public.%I(user_id)', t, t);
  END LOOP;
END $$;

CREATE INDEX idx_sales_customer ON public.sales(customer_id);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_quotation_items_quotation ON public.quotation_items(quotation_id);
CREATE INDEX idx_sales_order_items_order ON public.sales_order_items(order_id);
CREATE INDEX idx_sales_return_items_return ON public.sales_return_items(return_id);
CREATE INDEX idx_sales_payments_sale ON public.sales_payments(sale_id);
CREATE INDEX campaign_results_campaign_idx ON public.campaign_results(campaign_id);
CREATE INDEX campaign_share_plan_campaign_idx ON public.campaign_share_plan(campaign_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.permission_catalog (
  permission_key text PRIMARY KEY,
  module text NOT NULL,
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permission_catalog TO authenticated;
GRANT ALL ON public.permission_catalog TO service_role;
ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read permission catalog" ON public.permission_catalog FOR SELECT TO authenticated USING (true);

INSERT INTO public.permission_catalog (permission_key, module, action, description) VALUES
  ('sales.view','Sales','View','View sales records'),
  ('sales.create','Sales','Create','Create sales records'),
  ('sales.update','Sales','Update','Edit sales records'),
  ('sales.delete','Sales','Delete','Delete sales records'),
  ('sales.export','Sales','Export','Export sales data'),
  ('reports.view','Reports','View','View reports'),
  ('reports.export','Reports','Export','Export reports'),
  ('inventory.view','Inventory','View','View inventory'),
  ('inventory.update','Inventory','Update','Update inventory'),
  ('customers.view','Customers','View','View customers'),
  ('customers.update','Customers','Update','Edit customers'),
  ('finance.view','Finance','View','View finance records'),
  ('finance.update','Finance','Update','Edit finance records'),
  ('compliance.view','Compliance','View','View compliance and tax records'),
  ('compliance.update','Compliance','Update','Edit compliance and tax records'),
  ('employees.view','Employees','View','View employees'),
  ('employees.update','Employees','Update','Edit employees'),
  ('administration.manage','Administration','Manage','Manage administration settings and access');

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_catalog(permission_key) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'ALL' CHECK (scope IN ('ALL','BRANCH','DEPARTMENT','TEAM','OWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);
CREATE INDEX role_permissions_role_idx ON public.role_permissions(role);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage role permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'admin'::public.app_role, permission_key FROM public.permission_catalog;

CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_catalog(permission_key) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('allow','deny')),
  scope text NOT NULL DEFAULT 'ALL' CHECK (scope IN ('ALL','BRANCH','DEPARTMENT','TEAM','OWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own overrides" ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage overrides" ON public.user_permission_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.user_id = _user_id AND rp.permission_key = _permission_key
    )
    OR EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
      WHERE upo.user_id = _user_id AND upo.permission_key = _permission_key AND upo.effect = 'allow'
    )
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_permission_overrides d
    WHERE d.user_id = _user_id AND d.permission_key = _permission_key AND d.effect = 'deny'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

CREATE TABLE public.business_settings (
  setting_key text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  setting_value text NOT NULL DEFAULT '',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, setting_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.business_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_business_settings_updated BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  actor_label text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  previous_value text,
  new_value text,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_logs_created_idx ON public.admin_audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "append own audit logs" ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, phone, business_name,
    business_type, legal_form, sector, region, size_category,
    employee_count, annual_turnover, does_import, does_export, tax_registrations, activities
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'business_type',
    NEW.raw_user_meta_data->>'legal_form',
    NEW.raw_user_meta_data->>'sector',
    NEW.raw_user_meta_data->>'region',
    COALESCE(NEW.raw_user_meta_data->>'size_category', 'Not set'),
    NULLIF(NEW.raw_user_meta_data->>'employee_count','')::integer,
    NULLIF(NEW.raw_user_meta_data->>'annual_turnover','')::numeric,
    COALESCE((NEW.raw_user_meta_data->>'does_import')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'does_export')::boolean, false),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'tax_registrations','[]'::jsonb))),
      '{}'
    ),
    '{}'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $function$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;