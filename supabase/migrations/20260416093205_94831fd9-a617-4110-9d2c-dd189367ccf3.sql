INSERT INTO storage.buckets (id, name, public) VALUES ('relatorios', 'relatorios', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read relatorios" ON storage.objects FOR SELECT USING (bucket_id = 'relatorios');
CREATE POLICY "Authenticated users can upload relatorios" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'relatorios' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update relatorios" ON storage.objects FOR UPDATE USING (bucket_id = 'relatorios' AND auth.role() = 'authenticated');
