
CREATE TABLE public.observacoes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  retiro_id uuid REFERENCES public.retiros(id) ON DELETE SET NULL,
  pasto_id uuid REFERENCES public.pastos(id) ON DELETE SET NULL,
  capataz_nome text,
  tipo text DEFAULT 'geral',
  descricao text,
  foto_url text,
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_por text,
  resolvido_em timestamptz,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.observacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_observacoes_fazenda ON public.observacoes(fazenda_id);
CREATE INDEX idx_observacoes_resolvido ON public.observacoes(fazenda_id, resolvido);

CREATE POLICY "Gerente acessa observacoes da sua fazenda" ON public.observacoes
  FOR ALL TO authenticated
  USING (fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true));

CREATE POLICY "Admin acessa observacoes" ON public.observacoes
  FOR ALL TO authenticated
  USING (fazenda_id IN (SELECT f.id FROM fazendas f WHERE f.administrador_id IN (SELECT a.id FROM administradores a WHERE a.user_id = auth.uid())));

CREATE POLICY "Capataz insere observacoes" ON public.observacoes
  FOR INSERT TO authenticated
  WITH CHECK (retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true));

CREATE POLICY "Capataz le observacoes" ON public.observacoes
  FOR SELECT TO authenticated
  USING (retiro_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true));
