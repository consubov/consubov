
CREATE TABLE public.syncvet_tabela_precos (
  id uuid primary key default gen_random_uuid(),
  veterinario_id uuid not null references public.syncvet_equipe(id) on delete cascade,
  tipo_servico text not null,
  descricao text,
  valor numeric(10,2) not null,
  unidade text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syncvet_tabela_precos TO authenticated, anon;
GRANT ALL ON public.syncvet_tabela_precos TO service_role;
ALTER TABLE public.syncvet_tabela_precos DISABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE TYPE public.syncvet_status_pagamento AS ENUM ('pendente','pago','vencido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.syncvet_servicos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.syncvet_fazendas(id),
  estacao_id uuid references public.syncvet_estacoes_monta(id),
  veterinario_id uuid not null references public.syncvet_equipe(id),
  data_referencia date not null,
  animais_atendidos integer,
  km_total numeric(10,2),
  dias_trabalhados numeric(5,1),
  valor_total numeric(10,2) not null default 0,
  status public.syncvet_status_pagamento not null default 'pendente',
  data_vencimento date,
  observacoes text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syncvet_servicos TO authenticated, anon;
GRANT ALL ON public.syncvet_servicos TO service_role;
ALTER TABLE public.syncvet_servicos DISABLE ROW LEVEL SECURITY;

CREATE TABLE public.syncvet_servico_itens (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references public.syncvet_servicos(id) on delete cascade,
  tipo_item text not null,
  descricao text not null,
  quantidade numeric(10,2) not null default 1,
  valor_unitario numeric(10,2) not null,
  valor_total numeric(10,2) not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syncvet_servico_itens TO authenticated, anon;
GRANT ALL ON public.syncvet_servico_itens TO service_role;
ALTER TABLE public.syncvet_servico_itens DISABLE ROW LEVEL SECURITY;

CREATE TABLE public.syncvet_servico_manejos (
  servico_id uuid not null references public.syncvet_servicos(id) on delete cascade,
  manejo_id uuid not null references public.syncvet_manejos(id) on delete cascade,
  primary key (servico_id, manejo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syncvet_servico_manejos TO authenticated, anon;
GRANT ALL ON public.syncvet_servico_manejos TO service_role;
ALTER TABLE public.syncvet_servico_manejos DISABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.syncvet_tabela_precos (veterinario_id);
CREATE INDEX ON public.syncvet_servicos (fazenda_id);
CREATE INDEX ON public.syncvet_servicos (estacao_id);
CREATE INDEX ON public.syncvet_servicos (veterinario_id);
CREATE INDEX ON public.syncvet_servicos (status);
CREATE INDEX ON public.syncvet_servico_itens (servico_id);
CREATE INDEX ON public.syncvet_servico_manejos (manejo_id);
