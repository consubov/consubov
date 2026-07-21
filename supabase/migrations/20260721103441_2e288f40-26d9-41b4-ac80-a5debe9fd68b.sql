CREATE TABLE IF NOT EXISTS public.syncvet_racas_gestacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.syncvet_empresas(id) ON DELETE CASCADE,
  raca text NOT NULL,
  dias_gestacao integer NOT NULL DEFAULT 285,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, raca)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syncvet_racas_gestacao TO authenticated;
GRANT ALL ON public.syncvet_racas_gestacao TO service_role;
ALTER TABLE public.syncvet_racas_gestacao DISABLE ROW LEVEL SECURITY;