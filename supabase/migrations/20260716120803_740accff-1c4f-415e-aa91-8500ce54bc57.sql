ALTER TABLE public.consultores
  ADD COLUMN IF NOT EXISTS logo_esquerda_url text,
  ADD COLUMN IF NOT EXISTS logo_direita_url text;