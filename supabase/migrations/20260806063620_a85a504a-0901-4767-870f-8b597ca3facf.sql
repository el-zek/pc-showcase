ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path text;

CREATE POLICY "auth read product images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');