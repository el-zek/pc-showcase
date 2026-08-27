
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO anon, authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.product_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO anon, authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  location text,
  manager text,
  capacity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO anon, authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.inventory_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_purchases TO anon, authenticated;
GRANT ALL ON public.inventory_purchases TO service_role;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.inventory_purchases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.inventory_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  purchase_id uuid NOT NULL REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_purchase_items TO anon, authenticated;
GRANT ALL ON public.inventory_purchase_items TO service_role;
ALTER TABLE public.inventory_purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.inventory_purchase_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO anon, authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.stock_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO anon, authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access" ON public.stock_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;

CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_purchases_updated BEFORE UPDATE ON public.inventory_purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_purchase_items_updated BEFORE UPDATE ON public.inventory_purchase_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stock_transfers_updated BEFORE UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stock_movements_updated BEFORE UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
