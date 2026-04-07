
-- Storage bucket for map images
INSERT INTO storage.buckets (id, name, public) VALUES ('mapas', 'mapas', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload map images
CREATE POLICY "Admin upload mapas" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mapas' AND public.is_admin(auth.uid()));

-- Allow admins to update/delete map images
CREATE POLICY "Admin manage mapas" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'mapas' AND public.is_admin(auth.uid()));

-- Allow authenticated users to read map images
CREATE POLICY "Authenticated read mapas" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mapas');

-- Table: mapas
CREATE TABLE public.mapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fazenda_id UUID NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  imagem_url TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.mapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos mapas" ON public.mapas FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Gerente visualiza mapas" ON public.mapas FOR SELECT TO authenticated
USING (fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true));

CREATE POLICY "Capataz visualiza mapas" ON public.mapas FOR SELECT TO authenticated
USING (fazenda_id IN (SELECT r.fazenda_id FROM retiros r WHERE r.id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));

-- Table: pastos_mapa
CREATE TABLE public.pastos_mapa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mapa_id UUID NOT NULL REFERENCES public.mapas(id) ON DELETE CASCADE,
  pasto_id UUID NOT NULL REFERENCES public.pastos(id) ON DELETE CASCADE,
  coordenadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(mapa_id, pasto_id)
);

ALTER TABLE public.pastos_mapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos pastos_mapa" ON public.pastos_mapa FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Gerente visualiza pastos_mapa" ON public.pastos_mapa FOR SELECT TO authenticated
USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true)));

CREATE POLICY "Capataz visualiza pastos_mapa" ON public.pastos_mapa FOR SELECT TO authenticated
USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id IN (SELECT r.fazenda_id FROM retiros r WHERE r.id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))));
