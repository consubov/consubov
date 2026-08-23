ALTER TABLE public.visita_pastos
  ADD COLUMN IF NOT EXISTS meta_g_100kg numeric,
  ADD COLUMN IF NOT EXISTS kg_consumidos numeric,
  ADD COLUMN IF NOT EXISTS dias_consumo numeric;