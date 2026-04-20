-- Tabela pai: solicitação de lançamento manual em lote
CREATE TABLE public.solicitacoes_lancamento_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL,
  retiro_id uuid NOT NULL,
  capataz_user_id uuid,
  capataz_nome text,
  data_salga_geral timestamptz NOT NULL DEFAULT now(),
  total_sacos integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  motivo_recusa text,
  decidido_por uuid,
  decidido_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slm_retiro_status ON public.solicitacoes_lancamento_manual(retiro_id, status);
CREATE INDEX idx_slm_fazenda_status ON public.solicitacoes_lancamento_manual(fazenda_id, status);

-- Tabela filha: itens (um por pasto)
CREATE TABLE public.solicitacoes_lancamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_lancamento_manual(id) ON DELETE CASCADE,
  pasto_id uuid NOT NULL,
  num_sacos integer NOT NULL CHECK (num_sacos > 0),
  data_salga timestamptz NOT NULL,
  lancamento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sli_solicitacao ON public.solicitacoes_lancamento_itens(solicitacao_id);
CREATE INDEX idx_sli_pasto ON public.solicitacoes_lancamento_itens(pasto_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_slm_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_slm_updated_at
BEFORE UPDATE ON public.solicitacoes_lancamento_manual
FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();

-- RLS
ALTER TABLE public.solicitacoes_lancamento_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_lancamento_itens ENABLE ROW LEVEL SECURITY;

-- ===== Solicitações (pai) =====

-- Admin: tudo
CREATE POLICY "Admin acessa todas solicitacoes_lancamento_manual"
ON public.solicitacoes_lancamento_manual
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Capataz: insere para o próprio retiro
CREATE POLICY "Capataz cria solicitacoes_lancamento_manual"
ON public.solicitacoes_lancamento_manual
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pendente'
  AND retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  )
);

-- Capataz: lê do próprio retiro
CREATE POLICY "Capataz le solicitacoes_lancamento_manual"
ON public.solicitacoes_lancamento_manual
FOR SELECT
TO authenticated
USING (
  retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  )
);

-- Gerente: lê da fazenda
CREATE POLICY "Gerente le solicitacoes_lancamento_manual"
ON public.solicitacoes_lancamento_manual
FOR SELECT
TO authenticated
USING (
  fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g
    WHERE g.user_id = auth.uid() AND g.ativo = true
  )
);

-- Gerente: aprova/recusa (update) na fazenda
CREATE POLICY "Gerente atualiza solicitacoes_lancamento_manual"
ON public.solicitacoes_lancamento_manual
FOR UPDATE
TO authenticated
USING (
  fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g
    WHERE g.user_id = auth.uid() AND g.ativo = true
  )
)
WITH CHECK (
  fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g
    WHERE g.user_id = auth.uid() AND g.ativo = true
  )
);

-- Escritório: lê da fazenda
CREATE POLICY "Escritorio le solicitacoes_lancamento_manual"
ON public.solicitacoes_lancamento_manual
FOR SELECT
TO authenticated
USING (fazenda_id = get_escritorio_fazenda_id(auth.uid()));

-- ===== Itens (filhos) =====

-- Admin: tudo
CREATE POLICY "Admin acessa todos solicitacoes_lancamento_itens"
ON public.solicitacoes_lancamento_itens
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Capataz: insere itens em solicitações que ele criou (via retiro)
CREATE POLICY "Capataz cria solicitacoes_lancamento_itens"
ON public.solicitacoes_lancamento_itens
FOR INSERT
TO authenticated
WITH CHECK (
  solicitacao_id IN (
    SELECT s.id FROM solicitacoes_lancamento_manual s
    WHERE s.retiro_id IN (
      SELECT c.retiro_id FROM capatazes c
      WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )
);

-- Capataz: lê itens das próprias solicitações
CREATE POLICY "Capataz le solicitacoes_lancamento_itens"
ON public.solicitacoes_lancamento_itens
FOR SELECT
TO authenticated
USING (
  solicitacao_id IN (
    SELECT s.id FROM solicitacoes_lancamento_manual s
    WHERE s.retiro_id IN (
      SELECT c.retiro_id FROM capatazes c
      WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )
);

-- Gerente: lê itens das solicitações da fazenda
CREATE POLICY "Gerente le solicitacoes_lancamento_itens"
ON public.solicitacoes_lancamento_itens
FOR SELECT
TO authenticated
USING (
  solicitacao_id IN (
    SELECT s.id FROM solicitacoes_lancamento_manual s
    WHERE s.fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g
      WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  )
);

-- Gerente: pode atualizar itens (vincular lancamento_id na aprovação)
CREATE POLICY "Gerente atualiza solicitacoes_lancamento_itens"
ON public.solicitacoes_lancamento_itens
FOR UPDATE
TO authenticated
USING (
  solicitacao_id IN (
    SELECT s.id FROM solicitacoes_lancamento_manual s
    WHERE s.fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g
      WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  )
)
WITH CHECK (
  solicitacao_id IN (
    SELECT s.id FROM solicitacoes_lancamento_manual s
    WHERE s.fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g
      WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  )
);

-- Escritório: lê itens
CREATE POLICY "Escritorio le solicitacoes_lancamento_itens"
ON public.solicitacoes_lancamento_itens
FOR SELECT
TO authenticated
USING (
  solicitacao_id IN (
    SELECT s.id FROM solicitacoes_lancamento_manual s
    WHERE s.fazenda_id = get_escritorio_fazenda_id(auth.uid())
  )
);