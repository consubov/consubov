GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_fazendas TO authenticated;
GRANT ALL ON public.produtos_fazendas TO service_role;

ALTER TABLE public.produtos_fazendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver vinculos"
ON public.produtos_fazendas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia vinculos"
ON public.produtos_fazendas FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Gerente gerencia vinculos da sua fazenda"
ON public.produtos_fazendas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true AND g.fazenda_id = produtos_fazendas.fazenda_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true AND g.fazenda_id = produtos_fazendas.fazenda_id));