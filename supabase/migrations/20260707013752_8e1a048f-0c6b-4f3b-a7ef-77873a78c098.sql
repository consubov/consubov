ALTER TABLE public.visita_pastos
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS peso_medio_kg numeric,
  ADD COLUMN IF NOT EXISTS consumo_esperado_kg numeric,
  ADD COLUMN IF NOT EXISTS consumo_real_kg numeric;