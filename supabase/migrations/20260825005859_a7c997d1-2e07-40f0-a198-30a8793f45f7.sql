CREATE TABLE public.dietas_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_consultor_id uuid NOT NULL REFERENCES public.fazendas_consultor(id) ON DELETE CASCADE,
  nome text NOT NULL,
  fdn_percentual numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dietas_consultor TO authenticated;
GRANT ALL ON public.dietas_consultor TO service_role;

ALTER TABLE public.dietas_consultor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor gerencia dietas da sua fazenda"
ON public.dietas_consultor FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.fazendas_consultor f WHERE f.id = fazenda_consultor_id AND f.consultor_id = public.get_consultor_id(auth.uid())) OR public.is_admin(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.fazendas_consultor f WHERE f.id = fazenda_consultor_id AND f.consultor_id = public.get_consultor_id(auth.uid())) OR public.is_admin(auth.uid()));

CREATE TABLE public.penn_state_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  dieta_id uuid REFERENCES public.dietas_consultor(id) ON DELETE SET NULL,
  nome text NOT NULL DEFAULT 'Análise 1',
  peso_amostra_g numeric NOT NULL DEFAULT 0,
  peso_19mm_g numeric NOT NULL DEFAULT 0,
  peso_8mm_g numeric NOT NULL DEFAULT 0,
  peso_4mm_g numeric NOT NULL DEFAULT 0,
  peso_fundo_g numeric NOT NULL DEFAULT 0,
  fdn_percentual_usado numeric,
  percentual_19mm numeric NOT NULL DEFAULT 0,
  percentual_8mm numeric NOT NULL DEFAULT 0,
  percentual_4mm numeric NOT NULL DEFAULT 0,
  percentual_fundo numeric NOT NULL DEFAULT 0,
  fef numeric NOT NULL DEFAULT 0,
  "peNDF" numeric,
  aviso_divergencia text,
  ordem integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.penn_state_analises TO authenticated;
GRANT ALL ON public.penn_state_analises TO service_role;

ALTER TABLE public.penn_state_analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor gerencia analises da sua visita"
ON public.penn_state_analises FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.visitas_tecnicas v JOIN public.fazendas_consultor f ON f.id = v.fazenda_consultor_id WHERE v.id = visita_id AND f.consultor_id = public.get_consultor_id(auth.uid())) OR public.is_admin(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.visitas_tecnicas v JOIN public.fazendas_consultor f ON f.id = v.fazenda_consultor_id WHERE v.id = visita_id AND f.consultor_id = public.get_consultor_id(auth.uid())) OR public.is_admin(auth.uid()));

CREATE INDEX idx_penn_state_analises_visita ON public.penn_state_analises(visita_id);
CREATE INDEX idx_dietas_consultor_fazenda ON public.dietas_consultor(fazenda_consultor_id);

CREATE TRIGGER set_dietas_consultor_updated_at BEFORE UPDATE ON public.dietas_consultor
FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();

CREATE TRIGGER set_penn_state_analises_updated_at BEFORE UPDATE ON public.penn_state_analises
FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();