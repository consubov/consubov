ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS consumo_recria1 numeric;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS consumo_recria2 numeric;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS consumo_engorda numeric;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS margem_recria1 numeric;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS margem_recria2 numeric;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS margem_engorda numeric;