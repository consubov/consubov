
-- Create escritorios table
CREATE TABLE public.escritorios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.escritorios ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin acessa todos escritorios"
  ON public.escritorios FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Escritorio can read own record
CREATE POLICY "Escritorio acessa seu registro"
  ON public.escritorios FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Helper function to check if user is escritorio
CREATE OR REPLACE FUNCTION public.is_escritorio(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM escritorios WHERE user_id = _user_id AND ativo = true
  );
$$;

-- Helper function to get escritorio fazenda_id
CREATE OR REPLACE FUNCTION public.get_escritorio_fazenda_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fazenda_id FROM escritorios WHERE user_id = _user_id AND ativo = true LIMIT 1;
$$;

-- Add RLS policies for escritorio on existing tables

-- fazendas: read own fazenda
CREATE POLICY "Escritorio acessa sua fazenda"
  ON public.fazendas FOR SELECT TO authenticated
  USING (id = public.get_escritorio_fazenda_id(auth.uid()));

-- retiros: read retiros of own fazenda
CREATE POLICY "Escritorio acessa retiros da fazenda"
  ON public.retiros FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- pastos: read pastos of own fazenda
CREATE POLICY "Escritorio acessa pastos da fazenda"
  ON public.pastos FOR SELECT TO authenticated
  USING (retiro_id IN (
    SELECT r.id FROM retiros r WHERE r.fazenda_id = public.get_escritorio_fazenda_id(auth.uid())
  ));

-- lancamentos: read
CREATE POLICY "Escritorio acessa lancamentos da fazenda"
  ON public.lancamentos FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- ciclos: read
CREATE POLICY "Escritorio acessa ciclos da fazenda"
  ON public.ciclos FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- abates: read
CREATE POLICY "Escritorio acessa abates da fazenda"
  ON public.abates FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- mortalidades: read
CREATE POLICY "Escritorio acessa mortalidades da fazenda"
  ON public.mortalidades FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- observacoes: read
CREATE POLICY "Escritorio acessa observacoes da fazenda"
  ON public.observacoes FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- estoque_retiro: read + insert/update for stock management
CREATE POLICY "Escritorio acessa estoque da fazenda"
  ON public.estoque_retiro FOR ALL TO authenticated
  USING (retiro_id IN (
    SELECT r.id FROM retiros r WHERE r.fazenda_id = public.get_escritorio_fazenda_id(auth.uid())
  ));

-- movimentacoes_estoque: read + insert
CREATE POLICY "Escritorio acessa movimentacoes_estoque da fazenda"
  ON public.movimentacoes_estoque FOR ALL TO authenticated
  USING (retiro_id IN (
    SELECT r.id FROM retiros r WHERE r.fazenda_id = public.get_escritorio_fazenda_id(auth.uid())
  ));

-- transferencias_estoque: read only (cannot approve)
CREATE POLICY "Escritorio le transferencias da fazenda"
  ON public.transferencias_estoque FOR SELECT TO authenticated
  USING (
    (retiro_origem_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id = public.get_escritorio_fazenda_id(auth.uid())))
    OR
    (retiro_destino_id IN (SELECT r.id FROM retiros r WHERE r.fazenda_id = public.get_escritorio_fazenda_id(auth.uid())))
  );

-- notificacoes: read (escritorio sees notifications)
CREATE POLICY "Escritorio acessa notificacoes"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (public.is_escritorio(auth.uid()));

-- snapshots: read
CREATE POLICY "Escritorio acessa snapshots da fazenda"
  ON public.snapshots FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- produtos: already has public read for authenticated

-- movimentacoes_animais: read
CREATE POLICY "Escritorio acessa movimentacoes da fazenda"
  ON public.movimentacoes_animais FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- mapas: read
CREATE POLICY "Escritorio visualiza mapas"
  ON public.mapas FOR SELECT TO authenticated
  USING (fazenda_id = public.get_escritorio_fazenda_id(auth.uid()));

-- pastos_mapa: read
CREATE POLICY "Escritorio visualiza pastos_mapa"
  ON public.pastos_mapa FOR SELECT TO authenticated
  USING (mapa_id IN (
    SELECT m.id FROM mapas m WHERE m.fazenda_id = public.get_escritorio_fazenda_id(auth.uid())
  ));
