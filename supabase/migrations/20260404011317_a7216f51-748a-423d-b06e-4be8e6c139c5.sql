
CREATE TABLE public.movimentacoes_animais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL,
  retiro_id uuid NOT NULL,
  pasto_origem_id uuid NOT NULL,
  pasto_destino_id uuid NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  data timestamp with time zone NOT NULL DEFAULT now(),
  mes integer NOT NULL,
  ano integer NOT NULL,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes_animais ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin acessa movimentacoes"
ON public.movimentacoes_animais FOR ALL TO authenticated
USING (fazenda_id IN (
  SELECT f.id FROM fazendas f
  WHERE f.administrador_id IN (
    SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
  )
));

-- Capataz can insert transfers in their retiro
CREATE POLICY "Capataz insere movimentacoes"
ON public.movimentacoes_animais FOR INSERT TO authenticated
WITH CHECK (retiro_id IN (
  SELECT c.retiro_id FROM capatazes c
  WHERE c.user_id = auth.uid() AND c.ativo = true
));

-- Capataz can read transfers in their retiro
CREATE POLICY "Capataz le movimentacoes"
ON public.movimentacoes_animais FOR SELECT TO authenticated
USING (retiro_id IN (
  SELECT c.retiro_id FROM capatazes c
  WHERE c.user_id = auth.uid() AND c.ativo = true
));

-- Gerente can read transfers of their farm
CREATE POLICY "Gerente acessa movimentacoes"
ON public.movimentacoes_animais FOR SELECT TO authenticated
USING (fazenda_id IN (
  SELECT g.fazenda_id FROM gerentes g
  WHERE g.user_id = auth.uid() AND g.ativo = true
));
