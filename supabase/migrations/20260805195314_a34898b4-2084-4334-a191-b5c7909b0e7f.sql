ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_tipo_check;
ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_tipo_check CHECK (tipo IN ('rotina','confinamento','fabrica','conferencia_admin'));
ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_tecnicas_status_check;
ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_status_check CHECK (status IN ('rascunho','revisao','finalizada','em_andamento'));