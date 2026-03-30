
-- Add telefone and retiro_id to gerentes
ALTER TABLE public.gerentes ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.gerentes ADD COLUMN IF NOT EXISTS retiro_id uuid REFERENCES public.retiros(id);

-- Create capatazes table
CREATE TABLE IF NOT EXISTS public.capatazes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  user_id uuid,
  retiro_id uuid REFERENCES public.retiros(id),
  ativo boolean DEFAULT true,
  criado_em timestamp with time zone DEFAULT now()
);

-- Enable RLS on capatazes
ALTER TABLE public.capatazes ENABLE ROW LEVEL SECURITY;

-- RLS: Admin can manage capatazes via retiro->fazenda->administrador chain
CREATE POLICY "Admin acessa seus capatazes" ON public.capatazes
FOR ALL TO public
USING (
  retiro_id IN (
    SELECT r.id FROM retiros r
    WHERE r.fazenda_id IN (
      SELECT f.id FROM fazendas f
      WHERE f.administrador_id IN (
        SELECT a.id FROM administradores a
        WHERE a.user_id = auth.uid()
      )
    )
  )
);

-- RLS for gerentes table (admin access via fazenda)
CREATE POLICY "Admin acessa seus gerentes" ON public.gerentes
FOR ALL TO public
USING (
  fazenda_id IN (
    SELECT f.id FROM fazendas f
    WHERE f.administrador_id IN (
      SELECT a.id FROM administradores a
      WHERE a.user_id = auth.uid()
    )
  )
  OR retiro_id IN (
    SELECT r.id FROM retiros r
    WHERE r.fazenda_id IN (
      SELECT f.id FROM fazendas f
      WHERE f.administrador_id IN (
        SELECT a.id FROM administradores a
        WHERE a.user_id = auth.uid()
      )
    )
  )
);
