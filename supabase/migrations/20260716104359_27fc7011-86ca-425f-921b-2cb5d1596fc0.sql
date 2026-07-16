
-- Ampliar tipo de visita para aceitar 'fabrica'
ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_tipo_check;
ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_tipo_check
  CHECK (tipo = ANY (ARRAY['rotina'::text, 'confinamento'::text, 'fabrica'::text]));

-- Nova tabela: avaliação de quesitos da fábrica (para visitas do tipo 'fabrica')
CREATE TABLE public.avaliacoes_fabrica_quesito (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  quesito text NOT NULL,
  nota integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avaliacoes_fabrica_quesito_quesito_check
    CHECK (quesito = ANY (ARRAY[
      'organizacao_geral','armazenamento_insumos','controle_pragas',
      'equipamentos_manutencao','precisao_dosagem','seguranca_epi','rotulagem_identificacao'
    ])),
  CONSTRAINT avaliacoes_fabrica_quesito_nota_check CHECK (nota BETWEEN 1 AND 5),
  CONSTRAINT avaliacoes_fabrica_quesito_visita_quesito_key UNIQUE (visita_id, quesito)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_fabrica_quesito TO authenticated;
GRANT ALL ON public.avaliacoes_fabrica_quesito TO service_role;

ALTER TABLE public.avaliacoes_fabrica_quesito ENABLE ROW LEVEL SECURITY;

-- Consultores só acessam quesitos de suas próprias visitas
CREATE POLICY "Consultor gerencia quesitos de suas visitas"
ON public.avaliacoes_fabrica_quesito FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.visitas_tecnicas vt
  JOIN public.consultores c ON c.id = vt.consultor_id
  WHERE vt.id = avaliacoes_fabrica_quesito.visita_id
    AND c.user_id = auth.uid() AND c.ativo = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.visitas_tecnicas vt
  JOIN public.consultores c ON c.id = vt.consultor_id
  WHERE vt.id = avaliacoes_fabrica_quesito.visita_id
    AND c.user_id = auth.uid() AND c.ativo = true
));

CREATE TRIGGER trg_avaliacoes_fabrica_quesito_updated_at
BEFORE UPDATE ON public.avaliacoes_fabrica_quesito
FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();
