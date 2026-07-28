ALTER TABLE public.fazendas_consultor ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_fazendas_consultor_deleted_at ON public.fazendas_consultor(deleted_at);