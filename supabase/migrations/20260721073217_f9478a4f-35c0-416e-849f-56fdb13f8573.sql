
-- Extend customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS segment_id uuid,
  ADD COLUMN IF NOT EXISTS channel_id uuid;

-- Customer segments
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  rule_type text NOT NULL DEFAULT 'custom',
  min_spend numeric NOT NULL DEFAULT 0,
  min_orders integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_segments TO anon;
GRANT ALL ON public.customer_segments TO service_role;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage segments" ON public.customer_segments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customer_segments_updated BEFORE UPDATE ON public.customer_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marketing campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  budget numeric NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'sms',
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  target_segment_id uuid REFERENCES public.customer_segments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO anon;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage campaigns" ON public.marketing_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_marketing_campaigns_updated BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customer channels
CREATE TABLE IF NOT EXISTS public.customer_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'other',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_channels TO anon;
GRANT ALL ON public.customer_channels TO service_role;
ALTER TABLE public.customer_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage channels" ON public.customer_channels FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customer_channels_updated BEFORE UPDATE ON public.customer_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default channels
INSERT INTO public.customer_channels (name, type) VALUES
  ('Website','digital'),('Instagram','social'),('Facebook','social'),
  ('WhatsApp','messaging'),('Referral','word_of_mouth'),
  ('Walk-in','physical'),('Advertisement','ads')
ON CONFLICT (name) DO NOTHING;
