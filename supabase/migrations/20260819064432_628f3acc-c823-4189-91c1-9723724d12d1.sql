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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO anon, authenticated;
GRANT ALL ON public.finance_accounts TO service_role;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.finance_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_finance_accounts_updated BEFORE UPDATE ON public.finance_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payments TO anon, authenticated;
GRANT ALL ON public.finance_payments TO service_role;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.finance_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_finance_payments_updated BEFORE UPDATE ON public.finance_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transfers TO anon, authenticated;
GRANT ALL ON public.finance_transfers TO service_role;
ALTER TABLE public.finance_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.finance_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_finance_transfers_updated BEFORE UPDATE ON public.finance_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.finance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_audit_logs TO anon, authenticated;
GRANT ALL ON public.finance_audit_logs TO service_role;
ALTER TABLE public.finance_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.finance_audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);