
-- Create abates table
CREATE TABLE public.abates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id),
  retiro_id uuid NOT NULL REFERENCES public.retiros(id),
  pasto_id uuid NOT NULL REFERENCES public.pastos(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  data timestamp with time zone NOT NULL DEFAULT now(),
  mes integer NOT NULL,
  ano integer NOT NULL,
  usuario_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.abates ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin acessa abates" ON public.abates
  FOR ALL TO authenticated
  USING (fazenda_id IN (
    SELECT f.id FROM fazendas f
    WHERE f.administrador_id IN (
      SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
    )
  ));

-- Gerente read access
CREATE POLICY "Gerente acessa abates da fazenda" ON public.abates
  FOR SELECT TO authenticated
  USING (fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g
    WHERE g.user_id = auth.uid() AND g.ativo = true
  ));

-- Capataz can insert abates for their retiro
CREATE POLICY "Capataz insere abates" ON public.abates
  FOR INSERT TO authenticated
  WITH CHECK (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

-- Capataz can read abates for their retiro
CREATE POLICY "Capataz le abates" ON public.abates
  FOR SELECT TO authenticated
  USING (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  ));
