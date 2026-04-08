
-- Table: estoque_retiro
CREATE TABLE public.estoque_retiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retiro_id UUID NOT NULL REFERENCES public.retiros(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  ultimo_alerta_estoque TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (retiro_id, mes, ano)
);

ALTER TABLE public.estoque_retiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos estoque_retiro" ON public.estoque_retiro FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Gerente acessa estoque da fazenda" ON public.estoque_retiro FOR ALL TO authenticated
  USING (retiro_id IN (
    SELECT r.id FROM retiros r WHERE r.fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  ));

CREATE POLICY "Capataz le estoque do retiro" ON public.estoque_retiro FOR SELECT TO authenticated
  USING (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

-- Table: movimentacoes_estoque
CREATE TABLE public.movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retiro_id UUID NOT NULL REFERENCES public.retiros(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia_envio', 'transferencia_recebimento')),
  quantidade INTEGER NOT NULL,
  origem TEXT NOT NULL CHECK (origem IN ('compra', 'salga', 'transferencia', 'ajuste')),
  referencia_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todas movimentacoes_estoque" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Gerente acessa movimentacoes_estoque da fazenda" ON public.movimentacoes_estoque FOR ALL TO authenticated
  USING (retiro_id IN (
    SELECT r.id FROM retiros r WHERE r.fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  ));

CREATE POLICY "Capataz le movimentacoes_estoque do retiro" ON public.movimentacoes_estoque FOR SELECT TO authenticated
  USING (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

-- Table: transferencias_estoque
CREATE TABLE public.transferencias_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retiro_origem_id UUID NOT NULL REFERENCES public.retiros(id) ON DELETE CASCADE,
  retiro_destino_id UUID NOT NULL REFERENCES public.retiros(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  tipo_acao TEXT NOT NULL CHECK (tipo_acao IN ('solicitacao', 'envio')),
  solicitado_por UUID REFERENCES auth.users(id),
  aprovado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (retiro_origem_id <> retiro_destino_id)
);

ALTER TABLE public.transferencias_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todas transferencias_estoque" ON public.transferencias_estoque FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Gerente acessa transferencias da fazenda" ON public.transferencias_estoque FOR ALL TO authenticated
  USING (
    retiro_origem_id IN (
      SELECT r.id FROM retiros r WHERE r.fazenda_id IN (
        SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
      )
    )
    OR retiro_destino_id IN (
      SELECT r.id FROM retiros r WHERE r.fazenda_id IN (
        SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
      )
    )
  );

CREATE POLICY "Capataz le transferencias do retiro" ON public.transferencias_estoque FOR SELECT TO authenticated
  USING (
    retiro_origem_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)
    OR retiro_destino_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)
  );

CREATE POLICY "Capataz insere transferencias" ON public.transferencias_estoque FOR INSERT TO authenticated
  WITH CHECK (
    solicitado_por = auth.uid()
    AND (
      retiro_origem_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)
      OR retiro_destino_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true)
    )
  );
