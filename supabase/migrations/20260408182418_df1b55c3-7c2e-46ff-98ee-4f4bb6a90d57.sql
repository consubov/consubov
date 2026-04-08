-- Add ciclo_id to lancamentos
ALTER TABLE public.lancamentos ADD COLUMN ciclo_id uuid REFERENCES public.ciclos(id);

-- Backfill existing lancamentos with matching ciclo
UPDATE public.lancamentos l
SET ciclo_id = c.id
FROM public.ciclos c
WHERE c.fazenda_id = l.fazenda_id
  AND c.mes = l.mes_referencia
  AND c.ano = l.ano_referencia
  AND l.ciclo_id IS NULL;

-- Index for filtering by ciclo
CREATE INDEX idx_lancamentos_ciclo_id ON public.lancamentos(ciclo_id);