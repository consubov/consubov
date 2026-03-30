
-- Enable RLS on remaining tables
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teste ENABLE ROW LEVEL SECURITY;

-- Admin can read their own record
CREATE POLICY "Admin acessa seu registro"
ON public.administradores FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admin full access to snapshots
CREATE POLICY "Admin acessa seus snapshots"
ON public.snapshots FOR ALL TO authenticated
USING (
  fazenda_id IN (
    SELECT f.id FROM fazendas f
    WHERE f.administrador_id IN (
      SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
    )
  )
);

-- Admin full access to visitas
CREATE POLICY "Admin acessa suas visitas"
ON public.visitas FOR ALL TO authenticated
USING (
  fazenda_id IN (
    SELECT f.id FROM fazendas f
    WHERE f.administrador_id IN (
      SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
    )
  )
);

-- Gerente access to visitas
CREATE POLICY "Gerente acessa visitas da sua fazenda"
ON public.visitas FOR SELECT TO authenticated
USING (
  fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
  )
);

-- Gerente can read their own record
CREATE POLICY "Gerente acessa seu registro"
ON public.gerentes FOR SELECT TO authenticated
USING (user_id = auth.uid());
