
-- Create visita_currais table
CREATE TABLE IF NOT EXISTS public.visita_currais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  num_curral text NOT NULL,
  organizacao_fabrica_nota integer,
  organizacao_insumos_nota integer,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visita_currais_org_fabrica_range CHECK (organizacao_fabrica_nota IS NULL OR (organizacao_fabrica_nota BETWEEN 1 AND 5)),
  CONSTRAINT visita_currais_org_insumos_range CHECK (organizacao_insumos_nota IS NULL OR (organizacao_insumos_nota BETWEEN 1 AND 5))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_currais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_currais TO anon;
GRANT ALL ON public.visita_currais TO service_role;

CREATE INDEX IF NOT EXISTS visita_currais_visita_id_idx ON public.visita_currais(visita_id);

-- Extend avaliacoes_score to support currais
ALTER TABLE public.avaliacoes_score
  ALTER COLUMN visita_pasto_id DROP NOT NULL;

ALTER TABLE public.avaliacoes_score
  ADD COLUMN IF NOT EXISTS visita_curral_id uuid REFERENCES public.visita_currais(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS avaliacoes_score_visita_curral_id_idx ON public.avaliacoes_score(visita_curral_id);

-- Exactly one of visita_pasto_id / visita_curral_id must be set
ALTER TABLE public.avaliacoes_score
  DROP CONSTRAINT IF EXISTS avaliacoes_score_target_xor;

ALTER TABLE public.avaliacoes_score
  ADD CONSTRAINT avaliacoes_score_target_xor
  CHECK ((visita_pasto_id IS NOT NULL)::int + (visita_curral_id IS NOT NULL)::int = 1);
