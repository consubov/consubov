-- Add approval workflow columns to lancamentos
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS status_aprovacao text,
  ADD COLUMN IF NOT EXISTS motivo_recusa text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_salga_informada timestamp with time zone,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS criado_por uuid;

CREATE INDEX IF NOT EXISTS idx_lancamentos_status_aprovacao
  ON public.lancamentos(status_aprovacao)
  WHERE status_aprovacao IS NOT NULL;

-- Allow capataz to insert manual pending lancamentos for pastos in their retiro
DROP POLICY IF EXISTS "Capataz insere lancamentos manuais pendentes" ON public.lancamentos;
CREATE POLICY "Capataz insere lancamentos manuais pendentes"
ON public.lancamentos
FOR INSERT
TO authenticated
WITH CHECK (
  origem = 'manual'
  AND status_aprovacao = 'pendente_aprovacao'
  AND retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  )
);

-- Allow capataz to read their own manual lancamentos
DROP POLICY IF EXISTS "Capataz le seus lancamentos" ON public.lancamentos;
CREATE POLICY "Capataz le seus lancamentos"
ON public.lancamentos
FOR SELECT
TO authenticated
USING (
  retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  )
);

-- Allow gerente to update lancamentos in their fazenda (for approval/rejection)
DROP POLICY IF EXISTS "Gerente atualiza lancamentos da fazenda" ON public.lancamentos;
CREATE POLICY "Gerente atualiza lancamentos da fazenda"
ON public.lancamentos
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