CREATE POLICY "Consultores gerenciam suas logos"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'logos-consultor')
  WITH CHECK (bucket_id = 'logos-consultor');