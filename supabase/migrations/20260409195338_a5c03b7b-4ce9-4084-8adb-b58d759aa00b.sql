
-- Tabela transferencias_retiros
CREATE TABLE public.transferencias_retiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id),
  retiro_origem_id uuid NOT NULL REFERENCES public.retiros(id),
  retiro_destino_id uuid NOT NULL REFERENCES public.retiros(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  peso_medio numeric(10,2),
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  data_aceite timestamptz,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ACEITA', 'CANCELADA')),
  observacao text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_transf_retiros_fazenda ON public.transferencias_retiros(fazenda_id);
CREATE INDEX idx_transf_retiros_status ON public.transferencias_retiros(status);
CREATE INDEX idx_transf_retiros_origem ON public.transferencias_retiros(retiro_origem_id);
CREATE INDEX idx_transf_retiros_destino ON public.transferencias_retiros(retiro_destino_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_transferencias_retiros_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_transferencias_retiros_updated_at
BEFORE UPDATE ON public.transferencias_retiros
FOR EACH ROW
EXECUTE FUNCTION public.update_transferencias_retiros_updated_at();

-- RLS
ALTER TABLE public.transferencias_retiros ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin acessa todas transferencias_retiros"
ON public.transferencias_retiros FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Capataz pode inserir (origem ou destino é seu retiro)
CREATE POLICY "Capataz insere transferencias_retiros"
ON public.transferencias_retiros FOR INSERT
TO authenticated
WITH CHECK (
  (retiro_origem_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))
  OR
  (retiro_destino_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))
);

-- Capataz pode ler transferências do seu retiro
CREATE POLICY "Capataz le transferencias_retiros"
ON public.transferencias_retiros FOR SELECT
TO authenticated
USING (
  (retiro_origem_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))
  OR
  (retiro_destino_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))
);

-- Capataz pode atualizar (aceitar/cancelar) transferências do seu retiro
CREATE POLICY "Capataz atualiza transferencias_retiros"
ON public.transferencias_retiros FOR UPDATE
TO authenticated
USING (
  (retiro_origem_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))
  OR
  (retiro_destino_id IN (SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true))
);

-- Gerente lê transferências da fazenda
CREATE POLICY "Gerente le transferencias_retiros"
ON public.transferencias_retiros FOR SELECT
TO authenticated
USING (
  fazenda_id IN (SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true)
);

-- Escritório lê transferências da fazenda
CREATE POLICY "Escritorio le transferencias_retiros"
ON public.transferencias_retiros FOR SELECT
TO authenticated
USING (
  fazenda_id = get_escritorio_fazenda_id(auth.uid())
);
