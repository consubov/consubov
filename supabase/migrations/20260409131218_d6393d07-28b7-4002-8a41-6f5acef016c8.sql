
-- Independent lines (roads, rivers, fences, etc.)
CREATE TABLE public.linhas_mapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapa_id uuid NOT NULL REFERENCES public.mapas(id) ON DELETE CASCADE,
  coordenadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  cor text NOT NULL DEFAULT '#92400e',
  tipo text NOT NULL DEFAULT 'estrada',
  rotulo text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.linhas_mapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todas linhas_mapa" ON public.linhas_mapa
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Capataz visualiza linhas_mapa" ON public.linhas_mapa
  FOR SELECT TO authenticated
  USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id IN (
    SELECT r.fazenda_id FROM retiros r WHERE r.id IN (
      SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )));

CREATE POLICY "Gerente visualiza linhas_mapa" ON public.linhas_mapa
  FOR SELECT TO authenticated
  USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
  )));

CREATE POLICY "Escritorio visualiza linhas_mapa" ON public.linhas_mapa
  FOR SELECT TO authenticated
  USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id = get_escritorio_fazenda_id(auth.uid())));

-- Map elements/icons (house, corral, trough, water, gate, custom)
CREATE TABLE public.elementos_mapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapa_id uuid NOT NULL REFERENCES public.mapas(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',
  emoji text NOT NULL DEFAULT '📍',
  posicao_x numeric NOT NULL,
  posicao_y numeric NOT NULL,
  rotulo text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.elementos_mapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos elementos_mapa" ON public.elementos_mapa
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Capataz visualiza elementos_mapa" ON public.elementos_mapa
  FOR SELECT TO authenticated
  USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id IN (
    SELECT r.fazenda_id FROM retiros r WHERE r.id IN (
      SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )));

CREATE POLICY "Gerente visualiza elementos_mapa" ON public.elementos_mapa
  FOR SELECT TO authenticated
  USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
  )));

CREATE POLICY "Escritorio visualiza elementos_mapa" ON public.elementos_mapa
  FOR SELECT TO authenticated
  USING (mapa_id IN (SELECT m.id FROM mapas m WHERE m.fazenda_id = get_escritorio_fazenda_id(auth.uid())));

CREATE INDEX idx_linhas_mapa_mapa_id ON public.linhas_mapa(mapa_id);
CREATE INDEX idx_elementos_mapa_mapa_id ON public.elementos_mapa(mapa_id);
