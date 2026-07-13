
CREATE POLICY "Consultor read own despesa fotos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'despesas-consultor-fotos' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Consultor upload own despesa fotos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'despesas-consultor-fotos' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Consultor update own despesa fotos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'despesas-consultor-fotos' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Consultor delete own despesa fotos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'despesas-consultor-fotos' AND (auth.uid()::text = (storage.foldername(name))[1]));
