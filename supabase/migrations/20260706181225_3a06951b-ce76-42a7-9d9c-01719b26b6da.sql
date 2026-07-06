
-- consultores
CREATE TABLE public.consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultores TO authenticated;
GRANT ALL ON public.consultores TO service_role;
CREATE INDEX idx_consultores_user_id ON public.consultores(user_id);

-- fazendas_consultor
CREATE TABLE public.fazendas_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  nome_fazenda text NOT NULL,
  proprietario text,
  municipio text,
  uf text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fazendas_consultor TO authenticated;
GRANT ALL ON public.fazendas_consultor TO service_role;
CREATE INDEX idx_fazendas_consultor_consultor_id ON public.fazendas_consultor(consultor_id);

-- visitas_tecnicas
CREATE TABLE public.visitas_tecnicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  fazenda_consultor_id uuid NOT NULL REFERENCES public.fazendas_consultor(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'rotina' CHECK (tipo IN ('rotina','confinamento')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','finalizada')),
  hora_inicio timestamptz NOT NULL DEFAULT now(),
  hora_fim timestamptz,
  observacoes_gerais text,
  conclusao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_tecnicas TO authenticated;
GRANT ALL ON public.visitas_tecnicas TO service_role;
CREATE INDEX idx_visitas_tecnicas_consultor_id ON public.visitas_tecnicas(consultor_id);
CREATE INDEX idx_visitas_tecnicas_fazenda_id ON public.visitas_tecnicas(fazenda_consultor_id);

-- visita_pastos
CREATE TABLE public.visita_pastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  letra text NOT NULL,
  num_pasto text,
  qtd_animais integer,
  tipo_produto text,
  percentual_pv text,
  consumo_kg_dia numeric,
  observacao text,
  ordem integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_pastos TO authenticated;
GRANT ALL ON public.visita_pastos TO service_role;
CREATE INDEX idx_visita_pastos_visita_id ON public.visita_pastos(visita_id);

-- avaliacoes_score
CREATE TABLE public.avaliacoes_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_pasto_id uuid NOT NULL REFERENCES public.visita_pastos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('fezes','corporal','bebedouro')),
  nota integer NOT NULL CHECK (nota BETWEEN 1 AND 5)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_score TO authenticated;
GRANT ALL ON public.avaliacoes_score TO service_role;
CREATE INDEX idx_avaliacoes_score_pasto_id ON public.avaliacoes_score(visita_pasto_id);

-- helper functions (same pattern as is_admin/is_operador_fabrica)
CREATE OR REPLACE FUNCTION public.is_consultor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.consultores WHERE user_id = _user_id AND ativo = true);
$$;

CREATE OR REPLACE FUNCTION public.get_consultor_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.consultores WHERE user_id = _user_id AND ativo = true LIMIT 1;
$$;
