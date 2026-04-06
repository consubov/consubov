
ALTER TABLE public.administradores ADD COLUMN IF NOT EXISTS telefone text;

-- Add INSERT/UPDATE/DELETE policies for admins managing other admins
CREATE POLICY "Admin insere administradores"
ON public.administradores
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()));

CREATE POLICY "Admin atualiza administradores"
ON public.administradores
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()));
