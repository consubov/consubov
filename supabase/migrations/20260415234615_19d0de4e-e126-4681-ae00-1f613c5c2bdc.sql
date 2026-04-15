
-- Table: eventos_lote
CREATE TABLE public.eventos_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.pastos(id) ON DELETE CASCADE,
  tipo varchar NOT NULL CHECK (tipo IN ('pesagem','sanitario','pesagem_sanitario','observacao')),
  usuario_id uuid,
  data_evento timestamptz NOT NULL DEFAULT now(),
  dados jsonb DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos_lote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos eventos_lote" ON public.eventos_lote FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Capataz insere eventos_lote" ON public.eventos_lote FOR INSERT TO authenticated WITH CHECK (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));
CREATE POLICY "Capataz le eventos_lote" ON public.eventos_lote FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));
CREATE POLICY "Gerente le eventos_lote" ON public.eventos_lote FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true))));
CREATE POLICY "Escritorio le eventos_lote" ON public.eventos_lote FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id = get_escritorio_fazenda_id(auth.uid()))));

-- Table: pesagens
CREATE TABLE public.pesagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_lote(id) ON DELETE CASCADE,
  lote_id uuid NOT NULL REFERENCES public.pastos(id) ON DELETE CASCADE,
  total_pesado integer NOT NULL DEFAULT 0,
  pesos jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_calculada numeric,
  peso_medio_aplicado numeric,
  data_pesagem timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid
);

ALTER TABLE public.pesagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todas pesagens" ON public.pesagens FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Capataz insere pesagens" ON public.pesagens FOR INSERT TO authenticated WITH CHECK (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));
CREATE POLICY "Capataz le pesagens" ON public.pesagens FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));
CREATE POLICY "Gerente le pesagens" ON public.pesagens FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true))));
CREATE POLICY "Escritorio le pesagens" ON public.pesagens FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id = get_escritorio_fazenda_id(auth.uid()))));

-- Table: eventos_sanitarios
CREATE TABLE public.eventos_sanitarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_lote(id) ON DELETE CASCADE,
  lote_id uuid NOT NULL REFERENCES public.pastos(id) ON DELETE CASCADE,
  categoria varchar NOT NULL CHECK (categoria IN ('vermifugo','vacina','vitamina','antibiotico','outro')),
  medicamento text NOT NULL,
  dose text NOT NULL,
  lote_completo boolean NOT NULL DEFAULT true,
  quantidade_tratada integer,
  tem_carencia boolean NOT NULL DEFAULT false,
  dias_carencia integer DEFAULT 0,
  data_fim_carencia date,
  aplicador_id uuid,
  data_aplicacao timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos_sanitarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos eventos_sanitarios" ON public.eventos_sanitarios FOR ALL TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Capataz insere eventos_sanitarios" ON public.eventos_sanitarios FOR INSERT TO authenticated WITH CHECK (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));
CREATE POLICY "Capataz le eventos_sanitarios" ON public.eventos_sanitarios FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)));
CREATE POLICY "Gerente le eventos_sanitarios" ON public.eventos_sanitarios FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true))));
CREATE POLICY "Escritorio le eventos_sanitarios" ON public.eventos_sanitarios FOR SELECT TO authenticated USING (lote_id IN (SELECT p.id FROM pastos p WHERE p.retiro_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id = get_escritorio_fazenda_id(auth.uid()))));

-- Add columns to pastos
ALTER TABLE public.pastos ADD COLUMN IF NOT EXISTS ultima_pesagem_em timestamptz;
ALTER TABLE public.pastos ADD COLUMN IF NOT EXISTS ultimo_evento_sanitario_id uuid REFERENCES public.eventos_sanitarios(id);
ALTER TABLE public.pastos ADD COLUMN IF NOT EXISTS data_fim_carencia date;

-- Index for performance
CREATE INDEX idx_eventos_lote_lote_id ON public.eventos_lote(lote_id);
CREATE INDEX idx_eventos_lote_data ON public.eventos_lote(data_evento DESC);
CREATE INDEX idx_pesagens_lote_id ON public.pesagens(lote_id);
CREATE INDEX idx_eventos_sanitarios_lote_id ON public.eventos_sanitarios(lote_id);
