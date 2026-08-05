ALTER TABLE public.visitas_tecnicas
  ALTER COLUMN consultor_id DROP NOT NULL,
  ALTER COLUMN fazenda_consultor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS administrador_id uuid REFERENCES public.administradores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fazenda_id uuid REFERENCES public.fazendas(id) ON DELETE SET NULL;

ALTER TABLE public.visitas_tecnicas
  DROP CONSTRAINT IF EXISTS visitas_tecnicas_owner_exclusivo;

ALTER TABLE public.visitas_tecnicas
  ADD CONSTRAINT visitas_tecnicas_owner_exclusivo
  CHECK (num_nonnulls(consultor_id, administrador_id) = 1);

ALTER TABLE public.visita_pastos
  ADD COLUMN IF NOT EXISTS pasto_id uuid,
  ADD COLUMN IF NOT EXISTS retiro_nome text,
  ADD COLUMN IF NOT EXISTS fazenda_nome text,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS ultima_salga timestamptz,
  ADD COLUMN IF NOT EXISTS consumo_medio_g numeric;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_tecnicas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_pastos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_fotos TO authenticated;
GRANT ALL ON public.visitas_tecnicas TO service_role;
GRANT ALL ON public.visita_pastos TO service_role;
GRANT ALL ON public.visita_fotos TO service_role;

DROP POLICY IF EXISTS "Admins gerenciam suas visitas de conferencia" ON public.visitas_tecnicas;
CREATE POLICY "Admins gerenciam suas visitas de conferencia"
ON public.visitas_tecnicas FOR ALL TO authenticated
USING (administrador_id IS NOT NULL AND public.is_admin(auth.uid()))
WITH CHECK (administrador_id IS NOT NULL AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam pastos das visitas de conferencia" ON public.visita_pastos;
CREATE POLICY "Admins gerenciam pastos das visitas de conferencia"
ON public.visita_pastos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.visitas_tecnicas v WHERE v.id = visita_pastos.visita_id AND v.administrador_id IS NOT NULL) AND public.is_admin(auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.visitas_tecnicas v WHERE v.id = visita_pastos.visita_id AND v.administrador_id IS NOT NULL) AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam fotos das visitas de conferencia" ON public.visita_fotos;
CREATE POLICY "Admins gerenciam fotos das visitas de conferencia"
ON public.visita_fotos FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.visita_pastos vp
  JOIN public.visitas_tecnicas v ON v.id = vp.visita_id
  WHERE vp.id = visita_fotos.visita_pasto_id AND v.administrador_id IS NOT NULL
) AND public.is_admin(auth.uid()))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.visita_pastos vp
  JOIN public.visitas_tecnicas v ON v.id = vp.visita_id
  WHERE vp.id = visita_fotos.visita_pasto_id AND v.administrador_id IS NOT NULL
) AND public.is_admin(auth.uid()));