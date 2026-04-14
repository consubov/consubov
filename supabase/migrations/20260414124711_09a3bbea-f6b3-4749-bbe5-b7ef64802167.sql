
-- Add data_entrada and peso_entrada to pastos for dynamic weight/days calculation
ALTER TABLE public.pastos
  ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS peso_entrada NUMERIC NULL;

-- Initialize peso_entrada from existing peso_medio_kg where available
UPDATE public.pastos
SET peso_entrada = peso_medio_kg
WHERE peso_medio_kg IS NOT NULL AND peso_entrada IS NULL;
