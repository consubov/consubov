ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS cocho_cheio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foto_cocho_url text;