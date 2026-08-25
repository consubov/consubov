CREATE TABLE public.penn_state_analise_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  penn_state_analise_id uuid NOT NULL REFERENCES public.penn_state_analises(id) ON DELETE CASCADE,
  url text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_psaf_analise ON public.penn_state_analise_fotos(penn_state_analise_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.penn_state_analise_fotos TO authenticated;
GRANT ALL ON public.penn_state_analise_fotos TO service_role;

ALTER TABLE public.penn_state_analise_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor gerencia fotos das suas analises Penn State"
ON public.penn_state_analise_fotos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.penn_state_analises a
    JOIN public.visitas_tecnicas v ON v.id = a.visita_id
    WHERE a.id = penn_state_analise_fotos.penn_state_analise_id
      AND v.consultor_id = public.get_consultor_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.penn_state_analises a
    JOIN public.visitas_tecnicas v ON v.id = a.visita_id
    WHERE a.id = penn_state_analise_fotos.penn_state_analise_id
      AND v.consultor_id = public.get_consultor_id(auth.uid())
  )
);