ALTER TABLE public.consultores
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS modulo_despesas_ativo boolean NOT NULL DEFAULT false;