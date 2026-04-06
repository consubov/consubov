
-- Helper function to avoid recursion in admin checks
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM administradores WHERE user_id = _user_id AND ativo = true
  );
$$;

-- ===== FAZENDAS =====
DROP POLICY IF EXISTS "Admin acessa suas fazendas" ON public.fazendas;
CREATE POLICY "Admin acessa todas fazendas"
  ON public.fazendas FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== RETIROS =====
DROP POLICY IF EXISTS "Admin acessa seus retiros" ON public.retiros;
CREATE POLICY "Admin acessa todos retiros"
  ON public.retiros FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== PASTOS =====
DROP POLICY IF EXISTS "Admin acessa seus pastos" ON public.pastos;
CREATE POLICY "Admin acessa todos pastos"
  ON public.pastos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== LANCAMENTOS =====
DROP POLICY IF EXISTS "Admin acessa lancamentos_manuais" ON public.lancamentos;
CREATE POLICY "Admin acessa todos lancamentos"
  ON public.lancamentos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== CICLOS =====
DROP POLICY IF EXISTS "Admin acessa seus ciclos" ON public.ciclos;
CREATE POLICY "Admin acessa todos ciclos"
  ON public.ciclos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== CICLOS_AUDITORIA =====
DROP POLICY IF EXISTS "Admin acessa ciclos_auditoria" ON public.ciclos_auditoria;
CREATE POLICY "Admin acessa todos ciclos_auditoria"
  ON public.ciclos_auditoria FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== ABATES =====
DROP POLICY IF EXISTS "Admin acessa abates" ON public.abates;
CREATE POLICY "Admin acessa todos abates"
  ON public.abates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== MORTALIDADES =====
DROP POLICY IF EXISTS "Admin acessa mortalidades" ON public.mortalidades;
CREATE POLICY "Admin acessa todas mortalidades"
  ON public.mortalidades FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== MOVIMENTACOES_ANIMAIS =====
DROP POLICY IF EXISTS "Admin acessa movimentacoes" ON public.movimentacoes_animais;
CREATE POLICY "Admin acessa todas movimentacoes"
  ON public.movimentacoes_animais FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== OBSERVACOES =====
DROP POLICY IF EXISTS "Admin acessa observacoes" ON public.observacoes;
CREATE POLICY "Admin acessa todas observacoes"
  ON public.observacoes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== SNAPSHOTS =====
DROP POLICY IF EXISTS "Admin acessa seus snapshots" ON public.snapshots;
CREATE POLICY "Admin acessa todos snapshots"
  ON public.snapshots FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== VISITAS =====
DROP POLICY IF EXISTS "Admin acessa suas visitas" ON public.visitas;
CREATE POLICY "Admin acessa todas visitas"
  ON public.visitas FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== CAPATAZES =====
DROP POLICY IF EXISTS "Admin acessa seus capatazes" ON public.capatazes;
CREATE POLICY "Admin acessa todos capatazes"
  ON public.capatazes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== GERENTES =====
DROP POLICY IF EXISTS "Admin acessa seus gerentes" ON public.gerentes;
CREATE POLICY "Admin acessa todos gerentes"
  ON public.gerentes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== PRODUTOS =====
DROP POLICY IF EXISTS "Admin acessa seus produtos" ON public.produtos;
CREATE POLICY "Admin acessa todos produtos"
  ON public.produtos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
