ALTER TABLE public.tax_documents
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.tax_sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tax_documents_sale_id ON public.tax_documents(sale_id);