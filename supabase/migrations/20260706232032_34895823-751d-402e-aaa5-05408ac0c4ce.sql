
ALTER TABLE public.visita_fotos ALTER COLUMN visita_pasto_id DROP NOT NULL;

ALTER TABLE public.visita_fotos
  ADD COLUMN IF NOT EXISTS visita_curral_id uuid REFERENCES public.visita_currais(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS visita_fotos_visita_curral_id_idx ON public.visita_fotos(visita_curral_id);

ALTER TABLE public.visita_fotos
  DROP CONSTRAINT IF EXISTS visita_fotos_target_xor;

ALTER TABLE public.visita_fotos
  ADD CONSTRAINT visita_fotos_target_xor
  CHECK ((visita_pasto_id IS NOT NULL)::int + (visita_curral_id IS NOT NULL)::int = 1);
