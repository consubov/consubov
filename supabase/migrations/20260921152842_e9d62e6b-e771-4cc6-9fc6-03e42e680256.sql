GRANT SELECT ON public.gerentes_fazendas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gerentes_fazendas TO authenticated;
GRANT ALL ON public.gerentes_fazendas TO service_role;
GRANT SELECT ON public.capatazes_retiros TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.capatazes_retiros TO authenticated;
GRANT ALL ON public.capatazes_retiros TO service_role;

ALTER TABLE public.gerentes_fazendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capatazes_retiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gf_select_auth" ON public.gerentes_fazendas;
CREATE POLICY "gf_select_auth" ON public.gerentes_fazendas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "gf_admin_all" ON public.gerentes_fazendas;
CREATE POLICY "gf_admin_all" ON public.gerentes_fazendas FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "cr_select_auth" ON public.capatazes_retiros;
CREATE POLICY "cr_select_auth" ON public.capatazes_retiros FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cr_admin_all" ON public.capatazes_retiros;
CREATE POLICY "cr_admin_all" ON public.capatazes_retiros FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));