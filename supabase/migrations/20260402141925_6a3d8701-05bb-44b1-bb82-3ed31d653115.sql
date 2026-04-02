
-- Table: configuracoes_gerais
CREATE TABLE public.configuracoes_gerais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'parametro',
  chave text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  formula text,
  valor numeric,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.configuracoes_gerais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa configuracoes_gerais"
  ON public.configuracoes_gerais FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()
    )
  );

-- Table: configuracoes_historico
CREATE TABLE public.configuracoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL REFERENCES public.configuracoes_gerais(id) ON DELETE CASCADE,
  valor_antigo text,
  valor_novo text,
  alterado_por text,
  data timestamptz DEFAULT now()
);

ALTER TABLE public.configuracoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa configuracoes_historico"
  ON public.configuracoes_historico FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()
    )
  );
