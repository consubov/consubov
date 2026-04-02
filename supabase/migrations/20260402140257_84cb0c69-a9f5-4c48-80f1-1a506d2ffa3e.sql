
CREATE TABLE public.lancamentos_manuais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  retiro_id uuid NOT NULL REFERENCES public.retiros(id) ON DELETE CASCADE,
  pasto_id uuid NOT NULL REFERENCES public.pastos(id) ON DELETE CASCADE,
  mes_referencia integer NOT NULL,
  ano_referencia integer NOT NULL,
  num_animais integer NOT NULL DEFAULT 0,
  peso_medio_kg numeric,
  sexo text,
  categoria text,
  num_sacos integer NOT NULL DEFAULT 0,
  dias_no_pasto integer NOT NULL DEFAULT 1,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pasto_id, mes_referencia, ano_referencia)
);

ALTER TABLE public.lancamentos_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa lancamentos_manuais"
  ON public.lancamentos_manuais
  FOR ALL
  TO authenticated
  USING (
    fazenda_id IN (
      SELECT f.id FROM fazendas f
      WHERE f.administrador_id IN (
        SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
      )
    )
  );
