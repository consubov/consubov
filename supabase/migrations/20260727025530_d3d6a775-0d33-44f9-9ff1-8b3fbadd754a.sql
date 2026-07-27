ALTER TABLE public.visitas_tecnicas
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_deleted_at
ON public.visitas_tecnicas (deleted_at);

CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_consultor_active
ON public.visitas_tecnicas (consultor_id, hora_inicio DESC)
WHERE deleted_at IS NULL;