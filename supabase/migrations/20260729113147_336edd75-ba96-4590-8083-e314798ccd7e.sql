ALTER TABLE public.consultores
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_criado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_consultores_is_demo ON public.consultores (is_demo) WHERE is_demo = true;