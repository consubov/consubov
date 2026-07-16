ALTER TABLE public.consultores
  ADD COLUMN IF NOT EXISTS logo_modo text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS logo_personalizada_url text;

ALTER TABLE public.consultores DROP CONSTRAINT IF EXISTS consultores_logo_modo_check;
ALTER TABLE public.consultores ADD CONSTRAINT consultores_logo_modo_check
  CHECK (logo_modo IN ('padrao','substituir','adicionar'));