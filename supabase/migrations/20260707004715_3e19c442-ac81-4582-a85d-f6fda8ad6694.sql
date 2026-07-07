ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS objetivo_visita text,
  ADD COLUMN IF NOT EXISTS resumo_executivo text,
  ADD COLUMN IF NOT EXISTS indicadores_gerais text;