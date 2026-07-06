CREATE POLICY "Consultor fotos - authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'visitas-consultor-fotos');

CREATE POLICY "Consultor fotos - authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'visitas-consultor-fotos');

CREATE POLICY "Consultor fotos - authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'visitas-consultor-fotos');

CREATE POLICY "Consultor fotos - authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'visitas-consultor-fotos');
