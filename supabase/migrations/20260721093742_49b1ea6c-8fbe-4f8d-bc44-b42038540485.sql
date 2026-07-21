
CREATE POLICY "syncvet_medicamentos_authenticated_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'syncvet-medicamentos')
WITH CHECK (bucket_id = 'syncvet-medicamentos');
