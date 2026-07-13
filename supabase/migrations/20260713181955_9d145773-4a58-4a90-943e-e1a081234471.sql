
CREATE TABLE public.relatorios_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  tipo_periodo text NOT NULL CHECK (tipo_periodo IN ('semanal','quinzenal','mensal','personalizado')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  pdf_url text,
  gerado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_despesas TO authenticated;
GRANT ALL ON public.relatorios_despesas TO service_role;

ALTER TABLE public.relatorios_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor manages own relatorios despesas" ON public.relatorios_despesas
FOR ALL TO authenticated
USING (consultor_id = public.get_consultor_id(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (consultor_id = public.get_consultor_id(auth.uid()) OR public.is_admin(auth.uid()));

CREATE TABLE public.despesas_combustivel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES public.consultores(id) ON DELETE CASCADE,
  foto_cupom_url text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_despesa date NOT NULL DEFAULT CURRENT_DATE,
  relatorio_despesa_id uuid REFERENCES public.relatorios_despesas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despesas_consultor_data ON public.despesas_combustivel(consultor_id, data_despesa DESC);
CREATE INDEX idx_despesas_relatorio ON public.despesas_combustivel(relatorio_despesa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_combustivel TO authenticated;
GRANT ALL ON public.despesas_combustivel TO service_role;

ALTER TABLE public.despesas_combustivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor manages own despesas" ON public.despesas_combustivel
FOR ALL TO authenticated
USING (consultor_id = public.get_consultor_id(auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (consultor_id = public.get_consultor_id(auth.uid()) OR public.is_admin(auth.uid()));
