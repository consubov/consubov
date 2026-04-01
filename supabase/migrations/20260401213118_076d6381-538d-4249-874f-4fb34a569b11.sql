
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS consumo_esperado_kg numeric,
  ADD COLUMN IF NOT EXISTS consumo_real_kg numeric,
  ADD COLUMN IF NOT EXISTS indice_consumo numeric,
  ADD COLUMN IF NOT EXISTS status_consumo text,
  ADD COLUMN IF NOT EXISTS dias_intervalo integer;
