
CREATE TABLE public.avaliacao_fabrica_visita (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id uuid NOT NULL UNIQUE REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  organizacao_fabrica_nota integer CHECK (organizacao_fabrica_nota BETWEEN 1 AND 5),
  organizacao_insumos_nota integer CHECK (organizacao_insumos_nota BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacao_fabrica_visita TO authenticated;
GRANT ALL ON public.avaliacao_fabrica_visita TO service_role;

CREATE TRIGGER update_avaliacao_fabrica_visita_updated_at
  BEFORE UPDATE ON public.avaliacao_fabrica_visita
  FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();
