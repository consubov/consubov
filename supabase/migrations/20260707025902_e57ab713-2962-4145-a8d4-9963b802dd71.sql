
CREATE TABLE public.visita_topicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT '',
  texto text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visita_topicos_visita ON public.visita_topicos(visita_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_topicos TO authenticated;
GRANT ALL ON public.visita_topicos TO service_role;

CREATE TABLE public.visita_topico_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_topico_id uuid NOT NULL REFERENCES public.visita_topicos(id) ON DELETE CASCADE,
  url text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visita_topico_fotos_topico ON public.visita_topico_fotos(visita_topico_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_topico_fotos TO authenticated;
GRANT ALL ON public.visita_topico_fotos TO service_role;
