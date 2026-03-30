
-- Enable RLS on tables that don't have it yet
ALTER TABLE public.ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Capataz can read their own retiro
CREATE POLICY "Capataz acessa seu retiro"
ON public.retiros FOR SELECT TO authenticated
USING (
  id IN (
    SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
  )
);

-- Capataz can read pastos of their retiro
CREATE POLICY "Capataz acessa pastos do seu retiro"
ON public.pastos FOR SELECT TO authenticated
USING (
  retiro_id IN (
    SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
  )
);

-- Capataz can read fazenda of their retiro
CREATE POLICY "Capataz acessa fazenda do seu retiro"
ON public.fazendas FOR SELECT TO authenticated
USING (
  id IN (
    SELECT r.fazenda_id FROM retiros r
    WHERE r.id IN (
      SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )
);

-- Capataz can read ciclos of their fazenda
CREATE POLICY "Capataz acessa ciclos da sua fazenda"
ON public.ciclos FOR SELECT TO authenticated
USING (
  fazenda_id IN (
    SELECT r.fazenda_id FROM retiros r
    WHERE r.id IN (
      SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )
);

-- Admin can access all ciclos
CREATE POLICY "Admin acessa seus ciclos"
ON public.ciclos FOR ALL TO authenticated
USING (
  fazenda_id IN (
    SELECT f.id FROM fazendas f
    WHERE f.administrador_id IN (
      SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
    )
  )
);

-- Gerente can read ciclos of their fazenda
CREATE POLICY "Gerente acessa ciclos da sua fazenda"
ON public.ciclos FOR SELECT TO authenticated
USING (
  fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
  )
);

-- Capataz can insert lancamentos for pastos in their retiro
CREATE POLICY "Capataz insere lancamentos"
ON public.lancamentos FOR INSERT TO authenticated
WITH CHECK (
  pasto_id IN (
    SELECT p.id FROM pastos p
    WHERE p.retiro_id IN (
      SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )
);

-- Capataz can read their own lancamentos
CREATE POLICY "Capataz le seus lancamentos"
ON public.lancamentos FOR SELECT TO authenticated
USING (
  pasto_id IN (
    SELECT p.id FROM pastos p
    WHERE p.retiro_id IN (
      SELECT c.retiro_id FROM capatazes c WHERE c.user_id = auth.uid() AND c.ativo = true
    )
  )
);

-- Gerente can read lancamentos of their fazenda
CREATE POLICY "Gerente acessa lancamentos da sua fazenda"
ON public.lancamentos FOR SELECT TO authenticated
USING (
  pasto_id IN (
    SELECT p.id FROM pastos p
    WHERE p.retiro_id IN (
      SELECT r.id FROM retiros r
      WHERE r.fazenda_id IN (
        SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
      )
    )
  )
);

-- Gerente can read pastos of their fazenda
CREATE POLICY "Gerente acessa pastos da sua fazenda"
ON public.pastos FOR SELECT TO authenticated
USING (
  retiro_id IN (
    SELECT r.id FROM retiros r
    WHERE r.fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  )
);

-- Produtos: everyone authenticated can read
CREATE POLICY "Authenticated users can read produtos"
ON public.produtos FOR SELECT TO authenticated
USING (true);

-- Admin full access to produtos
CREATE POLICY "Admin acessa seus produtos"
ON public.produtos FOR ALL TO authenticated
USING (
  administrador_id IN (
    SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
  )
);

-- Capataz can read their own record
CREATE POLICY "Capataz acessa seu proprio registro"
ON public.capatazes FOR SELECT TO authenticated
USING (user_id = auth.uid());
