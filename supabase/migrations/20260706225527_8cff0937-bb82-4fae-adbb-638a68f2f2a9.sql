-- 1. visita_fotos
CREATE TABLE public.visita_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_pasto_id uuid NOT NULL REFERENCES public.visita_pastos(id) ON DELETE CASCADE,
  url text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_fotos TO authenticated;
GRANT ALL ON public.visita_fotos TO service_role;

CREATE INDEX idx_visita_fotos_pasto ON public.visita_fotos(visita_pasto_id);

-- 2. Atualiza check constraint de status em visitas_tecnicas
ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_status_check;
ALTER TABLE public.visitas_tecnicas
  ADD CONSTRAINT visitas_tecnicas_status_check
  CHECK (status IN ('rascunho','revisao','finalizada'));
