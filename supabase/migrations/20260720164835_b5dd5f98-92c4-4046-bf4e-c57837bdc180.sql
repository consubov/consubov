ALTER TABLE public.pesadores
  ADD COLUMN IF NOT EXISTS nome_empresa text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;