CREATE POLICY "tax docs read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'tax-documents');
CREATE POLICY "tax docs insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'tax-documents');
CREATE POLICY "tax docs update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'tax-documents') WITH CHECK (bucket_id = 'tax-documents');
CREATE POLICY "tax docs delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'tax-documents');