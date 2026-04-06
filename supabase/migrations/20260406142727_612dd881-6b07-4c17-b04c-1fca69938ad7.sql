CREATE POLICY "Admin deleta administradores"
ON public.administradores
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()
));