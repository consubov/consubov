
ALTER TABLE public.visita_topicos
  ADD COLUMN IF NOT EXISTS zona TEXT NOT NULL DEFAULT 'introducao';

ALTER TABLE public.visita_topicos
  DROP CONSTRAINT IF EXISTS visita_topicos_zona_check;

ALTER TABLE public.visita_topicos
  ADD CONSTRAINT visita_topicos_zona_check
  CHECK (zona IN ('introducao','desenvolvimento','conclusao'));
