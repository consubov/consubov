
CREATE TABLE public.indicadores_zootecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL UNIQUE REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  currais_ocupados integer,
  animais_ativos integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicadores_zootecnicos TO authenticated, anon;
GRANT ALL ON public.indicadores_zootecnicos TO service_role;

CREATE TABLE public.indicadores_zootecnicos_faixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicadores_zootecnicos_id uuid NOT NULL REFERENCES public.indicadores_zootecnicos(id) ON DELETE CASCADE,
  faixa text NOT NULL CHECK (faixa IN ('1-20','21-40','41-60','61-80','81-100','101-120','121+')),
  quantidade_animais integer,
  consumo_medio_pv numeric,
  ordem integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (indicadores_zootecnicos_id, faixa)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicadores_zootecnicos_faixa TO authenticated, anon;
GRANT ALL ON public.indicadores_zootecnicos_faixa TO service_role;

CREATE INDEX idx_indicadores_zootecnicos_faixa_ind_id
  ON public.indicadores_zootecnicos_faixa(indicadores_zootecnicos_id);

CREATE TRIGGER trg_indicadores_zootecnicos_updated_at
  BEFORE UPDATE ON public.indicadores_zootecnicos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
