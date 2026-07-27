CREATE TABLE public.visita_assinantes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cargo_funcao text NOT NULL DEFAULT 'Consultor Técnico',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visita_assinantes_visita ON public.visita_assinantes(visita_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_assinantes TO authenticated;
GRANT ALL ON public.visita_assinantes TO service_role;

ALTER TABLE public.visita_assinantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor dono da visita gerencia assinantes"
ON public.visita_assinantes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.visitas_tecnicas v
    JOIN public.consultores c ON c.id = v.consultor_id
    WHERE v.id = visita_assinantes.visita_id
      AND c.user_id = auth.uid()
      AND c.ativo = true
  )
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.visitas_tecnicas v
    JOIN public.consultores c ON c.id = v.consultor_id
    WHERE v.id = visita_assinantes.visita_id
      AND c.user_id = auth.uid()
      AND c.ativo = true
  )
  OR public.is_admin(auth.uid())
);

CREATE TRIGGER trg_visita_assinantes_updated_at
BEFORE UPDATE ON public.visita_assinantes
FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();